---
slug: /docker
sidebar_position: 2
---

# Docker Quick Start

Run **LiventCord** using Docker.

## Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop/) installed on your system.

## Run Dotnet On Docker
  ## Docker
   ```bash
   docker run -p 5005:5005 TheLp281/liventcord:latest
   ```
  ## Docker with json config
    ```bash
    docker run -p 5005:5005 -v appsettings.json TheLp281/liventcord:latest
    ```
  ## Directly pass arguments
    ```bash
    docker run -p 5005:5005 -e "APPSETTINGS__PORT=6000" -e "APPSETTINGS__DATABASETYPE=mysql" TheLp281/liventcord:latest
    ```

## Run Gin Websocket Server On Docker
  ## Docker
   ```bash
   docker run -p 8080:8080 TheLp281/liventcord-ws-api:latest
   ```

Your container is now running at `http://localhost:5005`.
