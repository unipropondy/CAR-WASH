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

// 3. Ensure _worker.js in dist
const workerScript = `export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
        let response = await env.ASSETS.fetch(request);

        // If 404 and not a static asset with file extension, fallback to /index.html
        if (response.status === 404 && !url.pathname.includes('.')) {
          const indexRequest = new Request(new URL('/index.html', url.origin), request);
          response = await env.ASSETS.fetch(indexRequest);
        }

        return response;
      }

      return fetch(request);
    } catch (err) {
      if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
        return env.ASSETS.fetch(new URL('/index.html', request.url));
      }
      return new Response('SPA Routing Error', { status: 500 });
    }
  }
};
`;

fs.writeFileSync(path.join(distDir, '_worker.js'), workerScript, 'utf8');
console.log('✓ Created dist/_worker.js (Worker request interceptor)');

// Also sync to public directory so future exports retain them
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
if (fs.existsSync(indexHtmlPath)) {
  fs.copyFileSync(indexHtmlPath, path.join(publicDir, '404.html'));
}
fs.writeFileSync(path.join(publicDir, '_redirects'), redirectsContent, 'utf8');
fs.writeFileSync(path.join(publicDir, '_worker.js'), workerScript, 'utf8');

console.log('[Cloudflare SPA Setup] Successfully prepared Cloudflare distribution files!');
