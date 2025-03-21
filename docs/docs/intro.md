---
slug: /
sidebar_position: 1
---

# Tutorial Intro

Get started with LiventCord in just a few steps.

## 🚀 Quick Start

**Jump in now:** **[liventcord.koyeb.app](https://liventcord.koyeb.app)**.
### Or:
# **Run Locally**

## Requirements
### 1. Install .NET SDK 8.0 https://dotnet.microsoft.com/en-us/download
### 2. Install Node (For frontend) https://nodejs.org/en/download
### 3. Install Go (Optional, for realtime updates) https://go.dev/dl/
### 3. Install Redis (Optional, for realtime updates) https://redis.io/docs/latest/operate/oss_and_stack/install/install-redis/


### Clone the repository:
```bash
git clone https://github.com/liventcord/Liventcord
cd Liventcord/server/src
```
### Run the Server (API)
```bash
dotnet run
```

### Run Vite for Development (SPA)
```bash
cd Liventcord/web
npm install
npm run dev
```
### Run Redis
```bash
redis-server
```

### Run Gin server for realtime updates (Requires redis)
```bash
cd Liventcord/server/go-ws-api
mv .env.example .env
go run main.go
```

.NET server runs at `http://localhost:5005`, while vite runs at `http://localhost:5173`.
