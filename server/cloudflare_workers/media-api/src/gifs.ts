export async function handleGifRequest(req: Request, event?: any) {
  const u = new URL(req.url);
  const query = u.searchParams.get("q");

  if (!query) {
    return new Response(
      JSON.stringify({ error: 'URL parameter "q" is missing' }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  const tenorApiKey = (event as any)?.TENOR_API_KEY;
  const giphyApiKey = (event as any)?.GIPHY_API_KEY;

  if (!tenorApiKey && !giphyApiKey) {
    return new Response(
      JSON.stringify({ error: "No GIF provider API key is configured" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  const cacheKey = new URL(req.url).toString();
  const cache = (globalThis as any).caches?.default;

  if (cache) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }

  try {
    const normalizedResults: any[] = [];

    if (tenorApiKey) {
      const tenorUrl = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${tenorApiKey}&client_key=my_test_app&limit=50`;
      const tenorResp = await fetch(tenorUrl);
      if (!tenorResp.ok)
        throw new Error(`Tenor HTTP error: ${tenorResp.status}`);
      const tenorData = (await tenorResp.json()) as any;
      if (tenorData.results) {
        for (const item of tenorData.results) {
          normalizedResults.push(item);
        }
      }
    } else if (giphyApiKey) {
      const totalNeeded = 50;
      const pageSize = 50;
      const allResults: any[] = [];

      for (let offset = 0; offset < totalNeeded; offset += pageSize) {
        const giphyUrl = `https://api.giphy.com/v1/gifs/search?api_key=${giphyApiKey}&q=${encodeURIComponent(query)}&limit=${pageSize}&offset=${offset}&rating=g`;
        const giphyResp = await fetch(giphyUrl);
        if (!giphyResp.ok)
          throw new Error(`Giphy HTTP error: ${giphyResp.status}`);
        const giphyData = (await giphyResp.json()) as any;
        if (giphyData.data) allResults.push(...giphyData.data);
      }

      for (const giphyItem of allResults) {
        const mediaFormats: Record<string, any> = {};
        if (giphyItem.images) {
          if (giphyItem.images.original)
            mediaFormats.gif = { url: giphyItem.images.original.url };
          if (giphyItem.images.downsized)
            mediaFormats.tinygif = { url: giphyItem.images.downsized.url };
        }

        normalizedResults.push({
          id: giphyItem.id,
          title: giphyItem.title,
          url: giphyItem.url,
          media_formats: mediaFormats,
        });
      }
    }

    const body = JSON.stringify({ results: normalizedResults });

    const response = new Response(body, {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });

    if (cache) {
      if (event && typeof event.waitUntil === "function") {
        event.waitUntil(cache.put(cacheKey, response.clone()));
      } else {
        await cache.put(cacheKey, response.clone());
      }
    }

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}
