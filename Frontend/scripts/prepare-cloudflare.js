const fs = require('fs');
const path = require('path');

const frontendDir = path.resolve(__dirname, '..');
const distDir = path.join(frontendDir, 'dist');
const publicDir = path.join(frontendDir, 'public');

console.log('[Cloudflare SPA Setup] Ensuring SPA routing fallback files in dist...');

if (!fs.existsSync(distDir)) {
  console.error('[Error] dist directory does not exist! Please run expo export first.');
  process.exit(1);
}

// 1. Copy index.html to 404.html
const indexHtmlPath = path.join(distDir, 'index.html');
const notFoundHtmlPath = path.join(distDir, '404.html');

if (fs.existsSync(indexHtmlPath)) {
  fs.copyFileSync(indexHtmlPath, notFoundHtmlPath);
  console.log('✓ Created dist/404.html (exact replica of index.html for instant SPA routing)');
} else {
  console.warn('! dist/index.html was not found.');
}

// 2. Ensure _redirects file in dist
const redirectsContent = '/*    /index.html   200\n';
fs.writeFileSync(path.join(distDir, '_redirects'), redirectsContent, 'utf8');
console.log('✓ Created dist/_redirects (/* -> /index.html 200 rule for Cloudflare)');

// 3. Remove _worker.js if present to prevent Cloudflare Worker asset error
const workerJsPath = path.join(distDir, '_worker.js');
if (fs.existsSync(workerJsPath)) {
  fs.unlinkSync(workerJsPath);
}

// 4. Create .assetsignore
const assetsIgnoreContent = '_worker.js\n.assetsignore\n';
fs.writeFileSync(path.join(distDir, '.assetsignore'), assetsIgnoreContent, 'utf8');

// Also sync to public directory so future exports retain them
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
if (fs.existsSync(indexHtmlPath)) {
  fs.copyFileSync(indexHtmlPath, path.join(publicDir, '404.html'));
}
fs.writeFileSync(path.join(publicDir, '_redirects'), redirectsContent, 'utf8');
fs.writeFileSync(path.join(publicDir, '.assetsignore'), assetsIgnoreContent, 'utf8');
const publicWorkerJs = path.join(publicDir, '_worker.js');
if (fs.existsSync(publicWorkerJs)) {
  fs.unlinkSync(publicWorkerJs);
}

console.log('[Cloudflare SPA Setup] Successfully prepared Cloudflare distribution files!');
