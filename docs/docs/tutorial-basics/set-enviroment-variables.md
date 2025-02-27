---
sidebar_position: 1
---

# Set Enviroment Variables

## .NET Server Configuration
1. Move `Properties/exampleSettings.json` to `Properties/appsettings.json`.
```bash
mv Properties/exampleSettings.json Properties/appsettings.json
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
    Type of database server for data storage. Supported options:
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

  - **FrontendUrl**:
    Url to add cors headers at.
    **Defaults to** `none`

  - **GifWorkerUrl**: 
    URL of the Cloudflare Worker for querying Tenor GIFs.
    **Defaults to** `"gif-worker.liventcord-a60.workers.dev"`

  - **ProxyWorkerUrl**:
    Url of the Cloudflare Worker for proxying external resources.
    **Defaults to** `"proxy.liventcord-a60.workers.dev"`
    
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
    The maximum number of metadata records that can be indexed or stored per domain within a day.
    **Defaults to** `100`
  
  - **MediaProxy**:
    Proxy adress for media previews.
    **Defaults to** `none`

  - **ExternalMediaLimit**:
    Size limit(in GB) for total media storage on proxying external resources. If limit is reached, oldest records will be replaced with new files.
    **Defaults to** `10`

  - **BuildFrontend**:
    Whether to build frontend assets on .net server start or not.
    **Defaults to** `none`



## Gin Server Configuration
1. Move .example.env to .env.

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
  
  -**RedisConnectionString**:
    Connection string for connecting redis
    **Defaults to** `localhost:6379`