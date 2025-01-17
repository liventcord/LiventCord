---
sidebar_position: 1
---

# Set Enviroment Variables

1. Create the `Properties/appsettings.json` file
2. Add the following JSON configuration:

    ```json
    {
      "AppSettings": {
        "Host": "127.0.0.1",
        "Port" : "5005",
        "RemoteConnection": "CONNECTION_STRING",
        "DatabaseType": "DATABASE_TYPE",
        "SqlitePath": "Data/database.db",
        "GifWorkerUrl": "WORKER_URL"
      }
    }
    ```
  - **Host**:
    Hostname the server will run at.
    (defaults to 0.0.0.0)

  - **Port**:
    Port the server will run at.
    (defaults to 5005)

  - **RemoteConnection**:
    Connection string for the database.

  - **DatabaseType**:
    Type of database server for data storage. Supported options:
      - **PostgreSQL**
      - **MySQL**
      - **MariaDB**
      - **SQLite**
    (defaults to "sqlite" if not provided).

  - **SqlitePath**
    File path where SQLite will store data
    (defaults to Data/liventcord.db)
  
  - **GifWorkerUrl**: 
    URL of the Cloudflare Worker for querying Tenor GIFs.