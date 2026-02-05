![MainPage](https://raw.githubusercontent.com/liventcord/.github/refs/heads/main/2025-12-06-024340_hyprshot.png)
![Emojis](https://raw.githubusercontent.com/liventcord/.github/refs/heads/main/2025-01-31-172631_hyprshot.png)
![Gifs](https://raw.githubusercontent.com/liventcord/.github/refs/heads/main/2025-01-31-172422_hyprshot.png)
![Profile](https://raw.githubusercontent.com/liventcord/.github/refs/heads/main/2025-12-21-015638_hyprshot.png)
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
dotnet ef migrations add InitialCreate
```
```bash
dotnet run
```
.NET server runs at `http://localhost:5005`

### Run Farm for Development (SPA)
```bash
cd web
pnpm install
mv .env.example .env
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
mv .env.example .env
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

### Contributing

Feel free to submit pull requests. We welcome contributions and improvements.

### TO-DO

## Features
- Cache uploaded attachments for each channel locally before they are ready to submit
- Add a upload slider for uploaded attachments
- Add a settings toggle for typing events
- Implement displaying guild emojis in the emoji selector
- Add an image context-menu search feature using TinEye etc (reverseImageSearch)
- Add a friend/guild status notifier on login (like Vencord) to display left guilds/friends (relationshipNotifier)
- Add a user's opened DM to the DMs list
- Make YouTube embeds use no cookies
- Add reactions
- Add a favorite GIFs system
- Add mention/ping notifications so messages show a red circle
- Make the server parse and save mentions for messages on submit/edit in the database

## Bug fixes

- Right-click context menu doesn't work on self-sent messages
- Typed message overlaps GIF/emoji and the send button on mobile
- Split API init request (it is too slow to fetch)
- Clicking on profiles looks broken on mobile
- HTTP URL appears duplicated when a message like "http://example.com/" is sent


### License

This project is licensed under the GNU General Public License v3.0
