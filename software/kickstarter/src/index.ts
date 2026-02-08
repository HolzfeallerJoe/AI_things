import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import * as fs from "fs";
import * as path from "path";

// Add stealth plugin to avoid detection
chromium.use(StealthPlugin());

const USER_DATA_DIR = path.join(__dirname, "..", "browser-data");
const OUTPUT_FILE = path.join(__dirname, "..", "backed-projects.json");

interface BackedProject {
  backingId: string;  // unique ID for each pledge (allows same project multiple times)
  name: string;
  amount: string;
  reward: string;
  status: boolean;  // true = successful pledge, false = canceled pledge
  arrived: boolean;
  url: string;
}

async function main() {
  // Ensure browser data directory exists
  if (!fs.existsSync(USER_DATA_DIR)) {
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  }

  console.log("Starting browser...\n");

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false, // Always visible - required for Cloudflare
    channel: "chrome",
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
    ],
    viewport: { width: 1280, height: 900 },
  });

  try {
    const page = context.pages()[0] || await context.newPage();

    // Navigate to backings page
    console.log("Navigating to Kickstarter backings page...\n");
    await page.goto("https://www.kickstarter.com/profile/backings", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    // Wait for page to stabilize
    await page.waitForTimeout(3000);

    // Check if we need to log in
    let currentUrl = page.url();
    if (currentUrl.includes("/login") || currentUrl.includes("challenge")) {
      console.log("========================================");
      console.log("Please log in to Kickstarter in the browser.");
      console.log("Complete any Cloudflare verification if prompted.");
      console.log("Waiting for you to reach your backings page...");
      console.log("========================================\n");

      // Wait for user to log in (up to 5 minutes)
      try {
        await page.waitForURL("**/profile/backings**", { timeout: 300000 });
        console.log("Login successful!\n");
        await page.waitForTimeout(2000);
      } catch {
        console.log("Timeout waiting for login. Please try again.");
        return;
      }
    }

    // Now scrape the projects
    const allProjects: BackedProject[] = [];
    let pageNum = 1;

    console.log("Fetching backed projects...\n");

    while (true) {
      if (pageNum > 1) {
        const url = `https://www.kickstarter.com/profile/backings?page=${pageNum}`;
        console.log(`Loading page ${pageNum}...`);
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForTimeout(2000);
      } else {
        console.log(`Processing page ${pageNum}...`);
      }

      // Wait for Cloudflare if needed
      let cfRetries = 0;
      while (cfRetries < 15) {
        const content = await page.content();
        if (content.includes('Just a moment') || content.includes('challenge-platform')) {
          if (cfRetries === 0) {
            console.log("  Waiting for Cloudflare (click checkbox if prompted)...");
          }
          await page.waitForTimeout(2000);
          cfRetries++;
        } else {
          break;
        }
      }

      // Click "Show more" buttons until all projects are loaded
      let clickCount = 0;
      while (clickCount < 20) {
        const showMoreBtn = await page.$('a.show_more_backings');
        if (showMoreBtn) {
          const isVisible = await showMoreBtn.isVisible();
          if (!isVisible) break;
          await showMoreBtn.click();
          console.log("  Loading more projects...");
          await page.waitForTimeout(1500);
          clickCount++;
        } else {
          break;
        }
      }

      // Extract projects from page
      const projects = await page.evaluate(() => {
        const results: any[] = [];

        // Find all tables and process each one
        const tables = document.querySelectorAll('table');

        for (const table of tables) {
          // Check which type of table this is based on header
          const headers = table.querySelectorAll('thead th');
          let isSuccessTable = false;
          let isCanceledTable = false;

          headers.forEach((th) => {
            const dataSort = th.getAttribute('data-sort');
            if (dataSort === 'fulfillment_status') {
              isSuccessTable = true;
            } else if (dataSort === 'status') {
              isCanceledTable = true;
            }
          });

          // Determine status for rows in this table
          const status = isSuccessTable ? true : (isCanceledTable ? false : true);

          // Find all backing rows in this table
          const backingRows = table.querySelectorAll('tr[id^="backing_"]');

          for (const row of backingRows) {
            // Get unique backing ID from row
            const backingId = row.id || '';

            // Get project link and name
            const projectLink = row.querySelector('a[href*="/projects/"]') as HTMLAnchorElement;
            if (!projectLink) continue;

            const projectName = projectLink.textContent?.trim() || '';
            const projectUrl = projectLink.href;

            // Collect all cells
            const cells = row.querySelectorAll('td');

            // Get reward tier from cell index 2
            let reward = '';
            if (cells[2]) {
              reward = cells[2].textContent?.trim() || '';
              // Clean up: get just the reward name (first line, remove add-on/delivery info)
              reward = reward.split('\n')[0].trim();
              // Remove asterisks used for emphasis
              reward = reward.replace(/^\*|\*$/g, '').trim();
            }

            // Get pledge amount
            const pledgeCell = cells[1];
            const pledgeCellText = pledgeCell?.textContent?.trim() || '';

            // Extract just the currency amount
            let amount = pledgeCellText;
            const amountMatch = amount.match(/(?:[A-Z]{1,3}\$|[$€£¥₹₽₩₪₴฿])\s*[\d.,]+|[\d.,]+\s*(?:[A-Z]{1,3}\$|[$€£¥₹₽₩₪₴฿])|[\d.,]+\s*[A-Z]{3}/i);
            amount = amountMatch ? amountMatch[0].trim() : amount;

            // Normalize: put currency after the value
            const prefixMatch = amount.match(/^([A-Z]{1,3}\$|[$€£¥₹₽₩₪₴฿])\s*([\d.,]+)$/i);
            if (prefixMatch) {
              amount = `${prefixMatch[2]} ${prefixMatch[1]}`;
            }

            // Check if reward has arrived - look for completion indicator
            const completedLink = row.querySelector('a.backer_completed_at');
            const arrived = completedLink?.classList.contains('completed') || false;

            if (projectName) {
              results.push({
                backingId: backingId,
                name: projectName,
                amount: amount,
                reward: reward,
                status: status,
                arrived: arrived,
                url: projectUrl,
              });
            }
          }
        }

        return results;
      });

      // Deduplicate by backing ID (allows same project with multiple pledges)
      for (const project of projects) {
        if (!allProjects.some(p => p.backingId === project.backingId)) {
          allProjects.push(project);
        }
      }
      console.log(`  Found ${projects.length} backings (${allProjects.length} unique total)`);

      // Check for next page
      const hasNextPage = await page.evaluate((currentPage: number) => {
        return !!document.querySelector(`a[href*="page=${currentPage + 1}"]`);
      }, pageNum);

      if (!hasNextPage || projects.length === 0) {
        break;
      }

      pageNum++;
      await page.waitForTimeout(1000);
    }

    // Display results
    if (allProjects.length === 0) {
      console.log("\nNo backings found.");
      console.log("This could mean you haven't backed any projects,");
      console.log("or Kickstarter's page structure has changed.");
    } else {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`Total backings: ${allProjects.length}`);
      console.log("=".repeat(60));

      // Group by status
      const successCount = allProjects.filter(p => p.status).length;
      const canceledCount = allProjects.filter(p => !p.status).length;
      console.log("\nBy Status:");
      console.log(`  Successful: ${successCount}`);
      console.log(`  Canceled: ${canceledCount}`);

      // Group by arrived
      const arrivedCount = allProjects.filter(p => p.arrived).length;
      const notArrivedCount = allProjects.length - arrivedCount;
      console.log("\nBy Arrival:");
      console.log(`  Arrived: ${arrivedCount}`);
      console.log(`  Not arrived: ${notArrivedCount}`);

      console.log("\n" + "=".repeat(60));
      console.log("All Backings:");
      console.log("=".repeat(60) + "\n");

      allProjects.forEach((project, index) => {
        console.log(`${index + 1}. ${project.name}`);
        console.log(`   Backing ID: ${project.backingId}`);
        console.log(`   Amount: ${project.amount}`);
        if (project.reward) console.log(`   Reward: ${project.reward}`);
        console.log(`   Status: ${project.status ? 'Successful' : 'Canceled'}`);
        console.log(`   Arrived: ${project.arrived ? 'Yes' : 'No'}`);
        console.log(`   URL: ${project.url}`);
        console.log();
      });

      // Save to JSON
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allProjects, null, 2));
      console.log(`Data saved to: ${OUTPUT_FILE}`);
    }

  } finally {
    console.log("\nClosing browser...");
    await context.close();
  }
}

main().catch(console.error);
