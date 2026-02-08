const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Store uploaded file info
let currentFile = {
  path: null,
  dir: null,
  basename: null,
  data: null
};

// Configure multer to preserve original path
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Store in a temp folder, we'll track original path from frontend
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

app.use(express.json());
app.use(express.static('public'));

// Upload JSON file
app.post('/api/upload', upload.single('jsonFile'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const jsonData = JSON.parse(fileContent);

    // Get original path from form data if provided
    const originalPath = req.body.originalPath || filePath;
    const originalDir = path.dirname(originalPath);
    const originalBasename = path.basename(originalPath, '.json');

    currentFile = {
      path: originalPath,
      dir: originalDir,
      basename: originalBasename,
      data: jsonData
    };

    res.json({
      success: true,
      filename: req.file.originalname,
      recordCount: Array.isArray(jsonData) ? jsonData.length : 1,
      data: jsonData
    });
  } catch (error) {
    res.status(400).json({ error: 'Invalid JSON file: ' + error.message });
  }
});

// Search the loaded JSON
app.post('/api/search', (req, res) => {
  try {
    if (!currentFile.data) {
      return res.status(400).json({ error: 'No file loaded' });
    }

    const { query, field, caseSensitive, exactMatch } = req.body;
    let data = currentFile.data;

    // Ensure we're working with an array
    if (!Array.isArray(data)) {
      data = [data];
    }

    const results = data.filter(item => {
      return searchObject(item, query, field, caseSensitive, exactMatch);
    });

    res.json({
      success: true,
      query,
      totalRecords: data.length,
      matchCount: results.length,
      results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save search results
app.post('/api/save', (req, res) => {
  try {
    const { results, query, saveDir } = req.body;

    if (!results) {
      return res.status(400).json({ error: 'No results to save' });
    }

    // Format date and time as YYYY-MM-DD_HH-MM-SS
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    const datetime = `${date}_${time}`;

    // Sanitize query for filename
    const sanitizedQuery = query
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 50);

    // Use provided saveDir or fall back to original file directory
    const targetDir = saveDir || currentFile.dir || __dirname;

    // Create filename with original name, query, date and time
    const filename = `${currentFile.basename || 'search'}_${sanitizedQuery}_${datetime}.json`;
    const savePath = path.join(targetDir, filename);

    // Ensure directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    fs.writeFileSync(savePath, JSON.stringify(results, null, 2));

    res.json({
      success: true,
      savedTo: savePath,
      filename
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to search within an object
function searchObject(obj, query, field, caseSensitive, exactMatch) {
  if (!query) return true;

  const searchQuery = caseSensitive ? query : query.toLowerCase();

  // If specific field is specified
  if (field && field !== '_all') {
    const value = getNestedValue(obj, field);
    if (value === undefined) return false;
    return matchValue(value, searchQuery, caseSensitive, exactMatch);
  }

  // Search all fields
  return searchAllFields(obj, searchQuery, caseSensitive, exactMatch);
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

function matchValue(value, query, caseSensitive, exactMatch) {
  if (value === null || value === undefined) return false;

  const stringValue = String(value);
  const compareValue = caseSensitive ? stringValue : stringValue.toLowerCase();

  if (exactMatch) {
    return compareValue === query;
  }
  return compareValue.includes(query);
}

function searchAllFields(obj, query, caseSensitive, exactMatch) {
  if (obj === null || obj === undefined) return false;

  if (typeof obj !== 'object') {
    return matchValue(obj, query, caseSensitive, exactMatch);
  }

  for (const key of Object.keys(obj)) {
    if (searchAllFields(obj[key], query, caseSensitive, exactMatch)) {
      return true;
    }
  }

  return false;
}

// Get available fields from loaded JSON
app.get('/api/fields', (req, res) => {
  if (!currentFile.data) {
    return res.json({ fields: [] });
  }

  const fields = new Set();
  const data = Array.isArray(currentFile.data) ? currentFile.data : [currentFile.data];

  if (data.length > 0) {
    extractFields(data[0], '', fields);
  }

  res.json({ fields: ['_all', ...Array.from(fields)] });
});

function extractFields(obj, prefix, fields) {
  if (obj === null || typeof obj !== 'object') return;

  for (const key of Object.keys(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    fields.add(fullPath);

    if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      extractFields(obj[key], fullPath, fields);
    }
  }
}

app.listen(PORT, () => {
  console.log(`JSON Search app running at http://localhost:${PORT}`);
});
