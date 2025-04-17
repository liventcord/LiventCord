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
### 3 Install Pnpm (For frontend) npm install -g pnpm
### 4. Install Go (Optional, for realtime updates) https://go.dev/dl/
### 5. Install Redis (Optional, for realtime updates) https://redis.io/docs/latest/operate/oss_and_stack/install/install-redis/


### Clone the repository:
```bash
git clone https://github.com/liventcord/Liventcord && cd Liventcord
```
### Run the Server (API)
```bash
cd server/src
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
Vite runs at `http://localhost:5173`.

### Run Redis
```bash
redis-server
```

### Run Gin server for realtime updates (Requires redis)
```bash
cd server/go-ws-api
mv .env.example .env
go run main.go
```
Gin server runs at `http://localhost:8080`