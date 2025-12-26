---
sidebar_position: 1
---

# Set Enviroment Variables

## Vite Frontend Configuration
1. Move .env.example to .env

#### Configuration Options
  - **VITE_BACKEND_URL**:
    The URL of the .NET backend server that the frontend will use for API requests.
    Note : for cypress tests, use 127.0.0.1 instead of localhost.
  
  - **VITE_GOOGLE_CLIENT_ID**:
    Used for authenticating users via Google OAuth during login.

## .NET Server Configuration
1. Move `Properties/exampleSettings.json` to `Properties/appsettings.json`.
```bash
cp Properties/exampleSettings.json Properties/appsettings.json
```

#### Configuration Options
  - **Host**:
    Hostname the server will run at.
    **Defaults to** `0.0.0.0`

  - **Port**:
    Port the server will run at.
    **Defaults to** `5005`

  - **RemoteConnection**:
    Connection string for the database.

  - **DatabaseType**:
    Type of database server for storage. Supported options:
      - **PostgreSQL**
      - **MySQL**
      - **MariaDB**
      - **Oracle**
      - **Firebird**
      - **SqlServer**
      - **SQLite**
    
    Defaults to `sqlite`

  -**MaxPoolSize**: 
    Maximum number of connections in the database pool.
    **Defaults to** `5`
    
  -**MinPoolSize**: 
    Minimum number of connections in the database pool.
    **Defaults to** `0`

  - **SqlitePath**:
    File path where SQLite will store data.
    **Defaults to** `Data/liventcord.db`
    
  - **JwtAccessTokenExpiryDays**:
    Expire days for jwt tokens
    **Defaults to** `7`

  - **JwtKey**:
    Jwt key used for signing authentication, Must be set for server.

  - **FrontendUrl**:
    Url to add cors headers at.
    **Defaults to** `none`

  - **GifWorkerUrl**:  
    URL of the Cloudflare Gif Worker for querying Tenor GIFs.  
    **Defaults to** `"https://gif-worker.liventcord-a60.workers.dev"`  
    See [how to set up the worker](run_cloudflare_workers.md).

  - **MediaWorkerUrl**:  
    URL of the Cloudflare Media Worker for storing app files.  
    **Defaults to** `none`  
    See [how to set up the worker](run_cloudflare_workers.md).


  - **WsUrl**:
    Url of the websocket golang server for emitting events.
    **Defaults to** `http://localhost:8080`

  - **MaxAvatarSize**:
    Maximum upload size(in MB) for avatar on guilds and profiles.
    **Defaults to** `3`
  
  - **MaxAttachmentsSize**:
    Maximum attachment size (in MB) allowed for message uploads.
    **Defaults to** `30`
  
  - **BotToken**:
    A token used to secure the discord importer bot endpoints for admin access.
    **Defaults to** `random generated number`
    
  - **EnableMetadataIndexing**:
    Index urls in message content for metadata display.
    **Defaults to** `true`

  - **MetadataDomainLimit**:
    The maximum number of metadata records that can be indexed per domain within a day.
    **Defaults to** `100`
  
  - **ServeFrontend**:
    Controls whether the .NET server serves the frontend (SPA, assets, and redirects).
    **Defaults to** `true`

  - **ServeLanding**:
    Controls whether the .NET server serves the landing page.
    **Defaults to** `true`

  - **RedisConnectionString**:
    Connection string for connecting redis.
    **Defaults to** `localhost:6379`

  - **RedisConnectionLimit**:
    Maximum number of concurrent redis connectons. 
    **Defaults** to 1.

## Go WS Server Configuration
```bash
cd Liventcord/server/go-ws-api
```
1. Move `.example.env` to `.env`.

```bash
mv .example.env .env
```
#### Configuration Options
  - **Host**:
    Hostname the server will run at.
    **Defaults to** `0.0.0.0`

  - **Port**:
    Port the server will run at.
    **Defaults to** `8080`

  - **DotnetApiUrl**:
    The URL used to verify the WebSocket authentication by passing the cookie to the .NET server.
    **Defaults to** `http://localhost:5005`
  
  - **RedisURI**:
    Connection string for connecting redis.
    **Defaults to** `localhost:6379`

  - **AppMode**:
    Use release or debug mode.
    **Defaults to** debug.

  - **AdminPassword**:
    Password that will be used for authenticating gin ws server
    **Defaults to** `none`

  - **PostgresURI**:
    Connection string for connecting PostgreSQL.
    **Defaults to** `postgres://postgres@localhost:5432/postgres?sslmode=disable`
  
  - **AllowedOrigins**:  
    Comma-separated list of origins that are allowed to connect to the WebSocket server via CORS.  
    **Defaults to** `http://localhost:3000`

## Gin Media Proxy Server Configuration
Note: This server is not indended to get directly accessed by clients.
```bash
cd Liventcord/server/media-api
```
1. Move `.env.example` to `.env`.
```bash
mv .env.example .env
```

#### Configuration Options

  - **ExternalMediaLimit**:
    Size limit(in GB) for total media storage on proxying external resources. If limit is reached, oldest records will be replaced with new files.
    **Defaults to** `10`

  - **MainServerUrl**:
    Url of main .net core server for sending attachments at.
    **Defaults to** `http://localhost:5005`

  - **AddToBlacklist**:
    Specifies a list of domains or URLs to be added to the blacklist. This should be provided as a JSON array string.

  - **AdminPassword**:
    Password that will be used for authenticating proxy server
    **Defaults to** `none`