# Cloudflare Workers
 
This directory contains all Cloudflare Worker services used by the application.

## Services

### **media-api**
Responsible for serving and uploading media files used by the application.

### **hitlog**
Logs hits made to landing page.

### **gif-api**
Handles searching and retrieving GIFs from Tenor.

---

## How to run

### **media-api**

Get your HYPERDRIVE_ID by creating a new Hyperdrive configuration in Cloudflare and adding your PostgreSQL or MySQL connection.

Write your HYPERDRIVE_ID inside wrangler.toml
```bash
name = "media-api"
compatibility_date = "2025-02-04"
compatibility_flags = ["nodejs_compat"]

[[hyperdrive]]
binding = "HYPERDRIVE"
id = "YOUR_HYPERDRIVE_ID"

```bash
$ pnpm run deploy
```


### **hitlog**

Get your HYPERDRIVE_ID by creating a new Hyperdrive configuration in Cloudflare and adding your PostgreSQL or MySQL connection.

Write your HYPERDRIVE_ID inside wrangler.toml
```bash
name = "hitlog"
compatibility_date = "2025-02-04"
compatibility_flags = ["nodejs_compat"]

[[hyperdrive]]
binding = "HYPERDRIVE"
id = "YOUR_HYPERDRIVE_ID"

```bash
$ pnpm run deploy
```

### **gif-api**
Create a new cloudflare worker and paste js source file from gif-api/gifWorker.js
