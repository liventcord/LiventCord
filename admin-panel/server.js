const express = require("express");
const fetch = require("node-fetch");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

dotenv.config();

const app = express();

const PORT = 5010;
const BACKEND_URLS = process.env.BACKEND_URLS
  ? process.env.BACKEND_URLS.split(",")
  : [
      "http://localhost:5005", // Main server
      "http://localhost:8080", // WS Server
    ];

const SERVICES = {
  "http://localhost:5005": "Main Server",
  "http://localhost:8080": "WS Server",
};

const AUTH_PASSWORD = process.env.AUTH_PASSWORD;

const cache = {};
const previousStatuses = {};
const logFile = path.join(__dirname, "status.log");

function logStatusChange(url, status) {
  const timestamp = new Date().toISOString();
  const serviceName = SERVICES[url] || url;
  const logLine = `[${timestamp}] ${serviceName} (${url}) is now ${status}\n`;
  fs.appendFileSync(logFile, logLine, "utf8");
}

function markServiceDown(url) {
  if (previousStatuses[url] !== true) {
    logStatusChange(url, "DOWN");
    previousStatuses[url] = true;
  }
}

app.use(express.static("static"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/health", async (req, res) => {
  try {
    const results = await Promise.allSettled(
      BACKEND_URLS.map(async (url) => {
        const response = await fetch(`${url}/health`, {
          headers: {
            Authorization: `Bearer ${AUTH_PASSWORD}`,
          },
        });

        const contentType = response.headers.get("content-type");
        let data;
        if (contentType && contentType.includes("application/json")) {
          data = await response.json();
        } else {
          data = await response.text();
        }

        const isCurrentlyDown = !response.ok;
        const prev = previousStatuses[url];
        if (prev !== undefined && prev !== isCurrentlyDown) {
          logStatusChange(url, isCurrentlyDown ? "DOWN" : "UP");
        }
        previousStatuses[url] = isCurrentlyDown;

        const result = { url, data, isDown: isCurrentlyDown };

        if (!isCurrentlyDown) {
          cache[url] = { ...result, lastOnline: new Date().toISOString() };
        }

        return result;
      }),
    );

    const services = results.map((result, index) => {
      const url = BACKEND_URLS[index];

      if (result.status === "fulfilled") {
        return result.value;
      }

      const cached = cache[url];
      if (cached) {
        markServiceDown(url);
        return {
          ...cached,
          isDown: true,
          lastOnline: cached.lastOnline,
        };
      }

      markServiceDown(url);
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
