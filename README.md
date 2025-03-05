![MainPage](https://raw.githubusercontent.com/liventcord/.github/refs/heads/main/2025-02-18-174630_hyprshot.png)
![Emojis](https://raw.githubusercontent.com/liventcord/.github/refs/heads/main/2025-01-31-172631_hyprshot.png)
![Gifs](https://raw.githubusercontent.com/liventcord/.github/refs/heads/main/2025-01-31-172422_hyprshot.png)





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

### Contributing

Feel free to fork the repository and submit pull requests. We welcome contributions and improvements.

### License

This project is licensed under the GNU General Public License v3.0
