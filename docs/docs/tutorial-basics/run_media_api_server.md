# Run media api server

Open a terminal and run:

```bash
cd liventcord/server/media-api
go run .
```

## Configuration

Set the following configuration values for the media API.

- ExternalMediaLimit
  - Maximum allowed size of external media in gigabytes.
  - Defaults to `10`.

- CloudflareMediaWorkerUrl
  - URL of the Cloudflare media worker.
  - See [How to set up cloudflare media worker](run_cloudflare_workers.md#media-api).

- MainServerUrl
  - URL of the main server used by the media API.

- AddToBlacklist
  - List of external media origins to add blacklist (array).

- AdminPassword
  - Password/token used for authenticating server.

Example configuration (TOML):

```toml
ExternalMediaLimit = 10
CloudflareMediaWorkerUrl = "https://your-cf-media-worker.example"
MainServerUrl = "http://localhost:5005"
AddToBlacklist = ["https://example.com"]
AdminPassword = "admin"
```
