/**
 * Build script for iNDRIASTIGPSMAP
 * Copies root web assets (index.html, style.css, script.js, icons) into www/ folder
 */
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const wwwDir = path.join(rootDir, 'www');

if (!fs.existsSync(wwwDir)) {
  fs.mkdirSync(wwwDir, { recursive: true });
}

const filesToCopy = ['index.html', 'style.css', 'script.js', 'manifest.json', 'icon.svg'];

filesToCopy.forEach((file) => {
  const src = path.join(rootDir, file);
  const dest = path.join(wwwDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied: ${file} -> www/${file}`);
  }
});

console.log('Web build complete: assets copied to www/');
