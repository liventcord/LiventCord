![App](https://raw.githubusercontent.com/liventcord/.github/refs/heads/main/afab7995-f75d-4d84-9a3c-da44755f744d-1771621784.png)
![Profile](https://raw.githubusercontent.com/liventcord/.github/refs/heads/main/0137a61a-713c-40f1-9c77-48e88e545df3-1771621697.png)
![Media](https://raw.githubusercontent.com/liventcord/.github/refs/heads/main/206a2aa6-78d0-47b1-ab35-eebbee0d8e35-1771621712.png)
![Friends](https://raw.githubusercontent.com/liventcord/.github/refs/heads/main/2025-12-21-015202_hyprshot.png)
![Settings](https://raw.githubusercontent.com/liventcord/.github/refs/heads/main/2025-12-21-015659_hyprshot.png)

## 🚀 Quick Start

**Jump in now:** **[liventcord.github.io](https://liventcord.github.io)**.

### Or:

# **Run Locally**

## Requirements

### 1. Install .NET SDK 8.0 https://dotnet.microsoft.com/en-us/download

### 2. Install Node (For frontend) https://nodejs.org/en/download

### 3 Install Pnpm (For frontend) npm install -g pnpm

### 4. Install Go https://go.dev/dl/

### 5. Install Redis (Optional, for realtime updates) https://redis.io/docs/latest/operate/oss_and_stack/install/install-redis/

### Clone the repository:

```bash
git clone https://github.com/liventcord/liventcord && cd liventcord
```

### Run the Server (API)

```bash
cd server/LiventCord
```

Create database

```bash
dotnet ef migrations add InitialCreate --context AppDbContext
```

```bash
dotnet run
```

.NET server runs at `http://localhost:5005`

### Run Vite for Development (SPA)

```bash
cd web
pnpm install
cp .env.example .env
pnpm run dev
```

Dev server runs at `http://localhost:3000`.

### Run Redis

```bash
redis-server
```

### Run Gin server for realtime updates (Requires redis)

```bash
cd server/go-ws-api
cp .env.example .env
go run main.go
```

Gin server runs at `http://localhost:8080`

---

## Docker

### Docker Compose

Run with Docker Compose

```bash
docker-compose up --build
```

### Docker Run

Run directly with Docker

```bash
docker run -p 5005:5005 -v appsettings.json thelp281/liventcord:latest
```

## Website

https://liventcord.github.io

## Docs

https://liventcord.github.io/LiventCord

## Project Overview

👉 **Repository:** https://github.com/liventcord

### Contributing

Feel free to submit pull requests. We welcome contributions and improvements.

### License

This project is licensed under the GNU General Public License v3.0
