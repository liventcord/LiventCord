---
sidebar_position: 1
---

# Set Enviroment Variables

1. Move `Properties/exampleSettings.json` to `Properties/appsettings.json`.

### Configuration Options
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
    **Defaults to** `sqlite`

  - **SqlitePath**:
    File path where SQLite will store data.
    **Defaults to** `Data/liventcord.db`
  
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
    Index urls in message content urls for metadata display.
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
    