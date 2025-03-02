export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");

    if (!targetUrl) {
      return new Response("Missing 'url' query parameter", { status: 400 });
    }

    try {
      const cache = caches.default;
      let response = await cache.match(request);

      const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": targetUrl,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1"
      };

      if (request.headers.has("Range")) {
        const rangeHeader = request.headers.get("Range");
        headers["Range"] = rangeHeader;
      }

      if (!response) {
        response = await fetch(targetUrl, { headers });

        if (response.status === 403) {
          return new Response("Forbidden", { status: 403 });
        }

        if (!response.ok) {
          const errorText = await response.text();
          return new Response(`Failed to fetch resource: ${errorText}`, { status: response.status });
        }

        response = new Response(response.body, response);
        response.headers.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=3600");

        await cache.put(request, response.clone());
      }

      response = new Response(response.body, response);
      response.headers.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=3600");

      response.headers.set("Access-Control-Allow-Origin", "*");
      response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

      return response;
    } catch (err) {
      return new Response(`Error fetching resource: ${err.message}`, { status: 500 });
    }
  }
};
