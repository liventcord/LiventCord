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
      "http://localhost:8080", // Ws Server
    ];
const AUTH_PASSWORD = process.env.AUTH_PASSWORD;

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
          return {
            url,
            status: response.status,
            data,
          };
        }),
      ),
    );

    const services = results.map((result) => {
      if (result.status === "fulfilled") {
        return result.value;
      } else {
        return {
          url: BACKEND_URLS[results.indexOf(result)],
          status: "error",
          data: { error: result.reason?.message || "Unknown error" },
        };
      }
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
