---
sidebar_position: 1
---

# Set enviroment variables

1. Create the `Properties/appsettings.json` file
2. Add the following JSON configuration:

    ```json
    {
      "ConnectionStrings": {
        "RemoteConnection": "YOUR_CONNECTION_STRING",
        "SqlitePath": "Data/database.db",
      },
      "AppSettings": {
        "SecretKey": "SECRET_KEY",
        "DatabaseType": "DATABASE_TYPE",
        "port" : "5005"
      }
    }
    ```
    Available Database Types:
  - **MongoDB**
  - **PostgreSQL**
  - **MySQL**
  - **MariaDB**
  - **SQLite**
  Defaults to sqlite if none provided