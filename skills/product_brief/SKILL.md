---
name: product_brief
description: Use this skill whenever the user asks to create a product brief, summarize a product, or write up a product idea/spec. Reads the "Product Brief.docx" template that ships with this skill and writes an Internal Product Brief as a Markdown file into the agent's current working directory.
---

# Product Brief

Generates an **Internal Product Brief** in Markdown. The authoritative structure lives in `Product Brief.docx` inside this skill's own directory. The skill reads that template, then writes a Markdown brief into the **current working directory** (the folder the agent is open in), filling it in from the product the user is describing.

## Steps

1. **Read the template structure** from `Product Brief.docx` in this skill directory. It's a `.docx` (a zip of XML). On Windows, extract and parse the text with PowerShell:

   ```powershell
   $skillDir = "C:\Users\Dominik\Projects\Private\AI_things\skills\product_brief"
   $tmp = Join-Path $env:TEMP ("pb_" + [guid]::NewGuid())
   Add-Type -AssemblyName System.IO.Compression.FileSystem
   [System.IO.Compression.ZipFile]::ExtractToDirectory((Join-Path $skillDir "Product Brief.docx"), $tmp)
   [xml]$doc = Get-Content (Join-Path $tmp "word\document.xml") -Raw
   $ns = New-Object System.Xml.XmlNamespaceManager($doc.NameTable)
   $ns.AddNamespace("w","http://schemas.openxmlformats.org/wordprocessingml/2006/main")
   foreach ($p in $doc.SelectNodes("//w:p", $ns)) {
     $list = if ($p.SelectSingleNode("w:pPr/w:numPr", $ns)) { "- " } else { "" }
     $text = (($p.SelectNodes(".//w:t", $ns)) | ForEach-Object { $_.InnerText }) -join ""
     if ($text.Trim()) { "$list$text" }
   }
   Remove-Item -Recurse -Force $tmp
   ```

   Use the docx as the source of truth for the section list and structure.

2. **Write a Markdown file into the current working directory.** Name it after the product (e.g. `<Product Name> - Product Brief.md`), or `Product Brief.md` if the product has no name yet. Follow the structure from the docx, with each section as a Markdown heading.

3. **Gather the details before writing.** Pull from the conversation, then **scan the current project** for anything relevant (e.g. `README`, docs, `package.json`/manifest, source layout, existing specs) to fill the sections. Never invent or guess details, and do not leave `_TBD_` markers or empty bullets. If, after scanning, a section's information is still unknown, **ask the user** for it rather than writing the file with gaps.

## Notes

- Output goes to the **current working directory**, never back into this skill folder.
- Keep the tone calm and plain-language, matching the example in the template (short verdicts, no jargon).
- The `.docx` is the canonical template; read it for the current structure and example.
