# Dev Environment Setup

This branch sets up environment for running the server.

## Quick Start
1. Install .NET SDK https://dotnet.microsoft.com/en-us/download
1. Clone the repository:
```bash
git clone https://github.com/liventcord/Liventcord --depth 1
git checkout dev
```

### Run the Server
```bash
dotnet run
```
---
### Set Environment Variables

1. Create the `Properties/appsettings.json` file
2. Add the following JSON configuration:

    ```json
    {
      "ConnectionStrings": {
        "RemoteConnection": "Host=host;Database=database;Username=username;Password=password;Port=port;SSL Mode=sslmode",
        "SqlitePath": "Data/database.db",
      },
      "AppSettings": {
        "SecretKey": "Secret-Key",
        "usePostgres": "false",
        "port" : "5005"
      }
    }
    ```
## Docker
### Docker Compose
Run with Docker Compose
```bash
ASPNETCORE_ENVIRONMENT=Development docker-compose up --build
```
### Docker Run
Run directly with Docker
```bash
docker run -p 5005:5005 -v /path/to/your/appsettings.json TheLp281/liventcord:latest
```
### Contributing

Feel free to fork the repository and submit pull requests. We welcome contributions and improvements.

### License

This project is licensed under the GNU General Public License v3.0
