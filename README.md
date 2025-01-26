# Server Setup

Run a LiventCord backend server

## Quick Start
### 1. Install .NET SDK 8.0 https://dotnet.microsoft.com/en-us/download
### 2. Install Node https://nodejs.org/en/download


## Clone the repository:
```bash
git clone https://github.com/liventcord/Liventcord
cd LiventCord/src
```
## Install dependencies
```bash
npm install
```
### Run the Server (API)
```bash
dotnet run
```
### Run Vite for Development (SPA)
**Note**: For using vite, you should login at dotnet server first.
```bash
npm run dev
```
---

## Website
https://liventcord.github.io

## Docs
https://liventcord.github.io/LiventCord

## Docker
### Docker Compose
Run with Docker Compose
```bash
docker-compose up --build
```
### Docker Run
Run directly with Docker
```bash
docker run -p 5005:5005 -v appsettings.json TheLp281/liventcord:latest
```

### Contributing

Feel free to fork the repository and submit pull requests. We welcome contributions and improvements.

### License

This project is licensed under the GNU General Public License v3.0
