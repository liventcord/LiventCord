---
slug: /docker
sidebar_position: 2
---

# Docker Quick Start

Run **LiventCord** using Docker.

## Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop/) installed on your system.

## Steps to Run

1. **Clone the Repository**
   ```bash
   git clone https://github.com/liventcord/Liventcord --depth 1
   cd LiventCord
   ```

2. **Run the Docker Container**
  ## Docker
   ```bash
   docker run -p 5005:5005 -v /path/to/your/appsettings.json TheLp281/liventcord:latest
   ```
  ## Docker Compose
  ```bash
  ASPNETCORE_ENVIRONMENT=Development 
  docker-compose up --build
  ```

Your container is now running at `http://localhost:5005`.

