addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event));
});

async function handleRequest(event) {
  const request = event.request;
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

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

  const apiKey = "apikey";
  const url = `https://tenor.googleapis.com/v2/search?q=${query}&key=${apiKey}&client_key=my_test_app&limit=50`;

  const cacheKey = new URL(request.url).toString();
  const cache = caches.default;

  let response = await cache.match(cacheKey);
  if (response) {
    return response;
  }

  try {
    const responseFromTenor = await fetch(url);
    if (!responseFromTenor.ok) {
      throw new Error(`HTTP error! Status: ${responseFromTenor.status}`);
    }

    const data = await responseFromTenor.json();

    response = new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });

    event.waitUntil(cache.put(cacheKey, response.clone()));

    return response;
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}
