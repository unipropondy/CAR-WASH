export default {
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
