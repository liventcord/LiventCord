# Main Environment Setup

This branch sets up environment for running the server.

## Quick Start

1. Clone the repository:
```bash
git clone https://github.com/liventcord/Liventcord --depth 1
git checkout dev
```
### Set Environment Variables

1. Create the `Properties/appsettings.json` file in your project directory.
2. Add the following JSON configuration, replacing placeholders with your actual values:

    ```json
    {
      "ConnectionStrings": {
        "RemoteConnection": "Host=host;Database=database;Username=username;Password=password;Port=port;SSL Mode=sslmode",
        "SqlitePath": "Data Source=<Database-name>.db",
      },
      "AppSettings": {
        "SecretKey": "Secret-Key",
        "usePostgres": "true/false",
        "port" : "port"
      }
    }
    ```

### Run the Server
```bash
dotnet run
```
---

### Contributing

Feel free to fork the repository and submit pull requests. We welcome contributions and improvements.

### License

This project is licensed under the GNU General Public License v3.0
