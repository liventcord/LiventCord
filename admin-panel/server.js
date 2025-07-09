const express = require("express");
const fetch = require("node-fetch");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

const PORT = 5010;
const BACKEND_URLS = process.env.BACKEND_URLS
  ? process.env.BACKEND_URLS.split(",")
  : [
      "http://localhost:5005", // Main server
      "http://localhost:5000", // Proxy Server
      "http://localhost:8080", // WS Server
    ];
const AUTH_PASSWORD = process.env.AUTH_PASSWORD;

const cache = {};

app.use(express.static("static"));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.get("/health", async (req, res) => {
  try {
    const results = await Promise.allSettled(
      BACKEND_URLS.map((url) =>
        fetch(`${url}/health`, {
          headers: {
            Authorization: AUTH_PASSWORD,
          },
        }).then(async (response) => {
          const contentType = response.headers.get("content-type");
          let data;
          if (contentType && contentType.includes("application/json")) {
            data = await response.json();
          } else {
            data = await response.text();
          }

          const result = {
            url,
            status: response.status,
            data,
            isDown: false,
          };

          if (response.ok) {
            cache[url] = { ...result, lastOnline: new Date().toISOString() };
          }

          return result;
        }),
      ),
    );

    const services = results.map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      }

      const url = BACKEND_URLS[index];
      const cached = cache[url];
      if (cached) {
        return {
          ...cached,
          isDown: true,
          lastOnline: cached.lastOnline,
        };
      }

      return {
        url,
        status: "error",
        data: { error: result.reason?.message || "Unknown error" },
        isDown: true,
      };
    });

    res.json({ services });
  } catch (err) {
    console.error("Error proxying /health:", err);
    res.status(500).json({ error: "Error fetching health data" });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server listening on http://localhost:${PORT}`);
});
