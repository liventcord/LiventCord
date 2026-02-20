---
slug: /
sidebar_position: 1
---

# Tutorial Intro

Get started with LiventCord in just a few steps.

## 🚀 Quick Start

**Jump in now:** **[liventcord.github.io](https://liventcord.github.io)**.

### Or:

# **Run Locally**

## Requirements

### 1. Install .NET SDK 8.0 https://dotnet.microsoft.com/en-us/download

### 2. Install Node (For developing frontend) https://nodejs.org/en/download

### 3. Install Pnpm (For developing frontend) npm install -g pnpm

### 4. Install Go (Optional, for realtime updates / External media display) https://go.dev/dl/

### 5. Install Redis (Optional, for realtime updates) https://redis.io/docs/latest/operate/oss_and_stack/install/install-redis/

### Clone the repository:

```bash
git clone https://github.com/liventcord/liventcord && cd liventcord
```

### Run the Server (API)

```bash
cd server/liventCord
```

Create database

```bash
dotnet ef migrations add InitialCreate --context AppDbContext
```

```bash
dotnet run
```

.NET server runs at `http://localhost:5005`

Note : This would automatically run pnpm install and build/serve frontend

### Run Vite for Development (SPA)

```bash
cd web
ppm install
pnpm run dev
```

Dev server runs at `http://localhost:3000`.

### Run Redis

```bash
redis-server
```

### Run Gin ws server for realtime updates (Requires redis)

```bash
cd server/go-ws-api
cp .env.example .env
go run .
```

Gin server runs at `http://localhost:8080`

To run the cloudflare worker services, See [how to set up the worker](tutorial-basics/run_cloudflare_workers.md).
