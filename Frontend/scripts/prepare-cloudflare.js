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

// 1. Ensure HTTPS redirect in index.html and copy to 404.html
const indexHtmlPath = path.join(distDir, 'index.html');
const notFoundHtmlPath = path.join(distDir, '404.html');

if (fs.existsSync(indexHtmlPath)) {
  let html = fs.readFileSync(indexHtmlPath, 'utf8');
  const httpsRedirectScript = `<script>if(location.protocol==='http:'&&!location.hostname.match(/^(localhost|127\\.0\\.0\\.1|\\d+\\.\\d+\\.\\d+\\.\\d+)$/)){location.replace('https://'+location.host+location.pathname+location.search+location.hash);}</script>`;
  if (!html.includes('location.protocol===\'http:\'')) {
    html = html.replace('<head>', '<head>\n    ' + httpsRedirectScript);
    fs.writeFileSync(indexHtmlPath, html, 'utf8');
    console.log('✓ Injected automatic HTTPS upgrade script into dist/index.html');
  }
  fs.writeFileSync(notFoundHtmlPath, html, 'utf8');
  console.log('✓ Created dist/404.html (exact replica of index.html with HTTPS upgrade)');
} else {
  console.warn('! dist/index.html was not found.');
}

// 2. Remove _redirects if present (Cloudflare Workers uses not_found_handling = "single-page-application" in wrangler.toml)
const distRedirects = path.join(distDir, '_redirects');
if (fs.existsSync(distRedirects)) {
  fs.unlinkSync(distRedirects);
  console.log('✓ Removed dist/_redirects (avoids infinite loop error with Workers Static Assets)');
}

const distWorker = path.join(distDir, '_worker.js');
if (fs.existsSync(distWorker)) {
  fs.unlinkSync(distWorker);
}

// 3. Create .assetsignore
const assetsIgnoreContent = '_worker.js\n.assetsignore\n';
fs.writeFileSync(path.join(distDir, '.assetsignore'), assetsIgnoreContent, 'utf8');

// Also sync to public directory
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
if (fs.existsSync(indexHtmlPath)) {
  fs.copyFileSync(indexHtmlPath, path.join(publicDir, '404.html'));
}
fs.writeFileSync(path.join(publicDir, '.assetsignore'), assetsIgnoreContent, 'utf8');

const publicRedirects = path.join(publicDir, '_redirects');
if (fs.existsSync(publicRedirects)) {
  fs.unlinkSync(publicRedirects);
}
const publicWorkerJs = path.join(publicDir, '_worker.js');
if (fs.existsSync(publicWorkerJs)) {
  fs.unlinkSync(publicWorkerJs);
}

console.log('[Cloudflare SPA Setup] Successfully prepared Cloudflare distribution files!');
