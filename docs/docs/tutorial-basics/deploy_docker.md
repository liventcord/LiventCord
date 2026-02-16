---
slug: /docker
sidebar_position: 2
---

# Docker Quick Start

Run **LiventCord** using Docker.

## Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop/) installed on your system.

### Run Dotnet On Docker

#### Docker

```bash
docker run -p 5005:5005 thelp281/liventcord:latest
```

#### Docker with json config

```bash
docker run -p 5005:5005 -v appsettings.json thelp281/liventcord:latest
```

#### Pass arguments

```bash
docker run -p 5005:5005 -e "APPSETTINGS__PORT=6000" -e "APPSETTINGS__DATABASETYPE=mysql" thelp281/liventcord:latest
```

Your container is now running at `http://localhost:5005`.

### Run Go WS Server On Docker

#### Docker

```bash
docker run -p 8080:8080 thelp281/liventcord-ws-api:latest
```

Your container is now running at `http://localhost:8080`.

#### Pass arguments

```bash
docker run -p 8080:8080 -e "DotnetApiUrl=http://localhost:5005" -e "AdminPassword=admin" thelp281/liventcord-ws-api:latest
```

### Run Go Media Api On Docker

#### Docker

```bash
docker run -p 5000:5000 thelp281/liventcord-media-api:latest
```

#### Pass arguments

```bash
docker run -p 8080:8080 -e "MainServerUrl=http://localhost:5005" -e "AdminPassword=admin" thelp281/liventcord-media-api:latest
```

Your container is now running at `http://localhost:5000`.
