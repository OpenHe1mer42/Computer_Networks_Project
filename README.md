# Computer Networks Project — TCP client / server

Node.js **JSON-over-TCP** chat and remote file commands, plus a small **HTTP stats** endpoint. Built for **Projekti 2 — Rrjeta Kompjuterike** (`rrjeta-sockets`).

## Requirements

- **Node.js** ≥ 20  
- Dependencies: `npm install`

## Quick start

1. **Terminal A — start the server** (leave it running):

   ```bash
   npm run server
   ```

   You should see log lines indicating the TCP socket and HTTP stats server are listening (defaults: `127.0.0.1:4000` and `127.0.0.1:8080`).

2. **Terminal B — start the client**:

   ```bash
   npm run client
   ```

3. At the `socket>` prompt, type **`/help`** for CLI commands. Plain text (no leading `/`) sends a **chat** message to the server.

**Watch mode** (auto-restart on file changes):

```bash
npm run dev:server
npm run dev:client
```

## Configuration

Optional **`.env`** in the project root (loaded via `dotenv`). Keep **socket host/port aligned** between any machines or processes that run the server and the client.

| Variable | Purpose | Default |
|----------|---------|---------|
| `SOCKET_HOST` | TCP bind / connect host | `127.0.0.1` |
| `SOCKET_PORT` | TCP port | `4000` |
| `MAX_CONNECTIONS` | Max simultaneous TCP clients | `4` |
| `INACTIVITY_TIMEOUT_MS` | Socket idle timeout | `60000` |
| `HTTP_HOST` | Stats HTTP bind host | `127.0.0.1` |
| `HTTP_PORT` | Stats HTTP port | `8080` |
| `ADMIN_SECRET` | Server-side secret for admin role | `change-me-admin-secret` |
| `CLIENT_ID` | Default client id (hello) | `client-1` |
| `CLIENT_NAME` | Default display name | `Client 1` |
| `CLIENT_ADMIN_TOKEN` | If set, sent as `adminToken` on hello (match `ADMIN_SECRET` for admin) | *(empty)* |
| `SERVER_FILES_DIR` | Server file sandbox root | `storage/server-files` |
| `SERVER_LOG_FILE` | Server JSON log | `storage/logs/server.log` |
| `MESSAGE_LOG_FILE` | Append-only message NDJSON | `storage/messages/client-messages.ndjson` |
| `CLIENT_UPLOADS_DIR` | Local files read for `/upload` | `storage/client/uploads` |
| `CLIENT_DOWNLOADS_DIR` | Where `/download` saves | `storage/client/downloads` |
| `STATS_RECENT_MESSAGE_LIMIT` | Recent rows exposed in stats | `25` |
| `READ_ONLY_RESPONSE_DELAY_MS` | Artificial delay for non-admin commands | `150` |
| `RECONNECT_DELAY_MS` | Delay between reconnect attempts | `3000` |

## Protocol (high level)

- One **JSON object per line** (newline-delimited), UTF-8.
- Client must send a **`hello`** frame first; server replies with **`hello_ack`** and a **role** (`admin` or `readonly`).
- **Admin:** `adminToken` in `hello` must equal `ADMIN_SECRET` (CLI: `npm run client -- --adminToken <secret>`).
- Frame types include **`chat`**, **`command`**, **`ack`**, **`command_result`**, **`error`**, **`system`**.

## Client CLI

| Input | Action |
|-------|--------|
| `/help` | Show commands |
| `/list [path]` | List directory on server |
| `/read <filename>` | Read file from server sandbox |
| `/info <filename>` | File metadata |
| `/search <keyword>` | Search under server sandbox |
| `/upload <filename>` | Upload from local `CLIENT_UPLOADS_DIR` |
| `/download <filename>` | Save to local `CLIENT_DOWNLOADS_DIR` |
| `/delete <filename>` | Delete on server (**admin** only) |
| `/quit` | Disconnect |

**Read-only** clients cannot run disallowed commands (for example `upload` / `delete`).

## HTTP stats

With the server running:

```http
GET http://127.0.0.1:8080/stats
```

Returns JSON: active clients, connection counters, recent messages, etc. Any other path returns `404`.

## Project layout

```text
src/
  config/env.js          # Central config + env parsing
  shared/                 # Logger, protocol, safe paths
  server/
    index.js              # Boot: TCP + HTTP stats
    transport/tcpServer.js
    http/                 # Stats HTTP server
    services/             # Registry, messages, files, commands
  client/
    index.js              # CLI entry
    transport/tcpClient.js
    cli/runCli.js
    services/
```

## Tests

```bash
npm test
```

Uses Node’s built-in test runner; add `*.test.js` files as you grow coverage.

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| `ECONNREFUSED` on connect | Server not running, wrong `SOCKET_HOST` / `SOCKET_PORT`, or firewall |
| `EADDRINUSE` on server start | Port already taken (another `npm run server` or other app). Stop the old process or change ports in `.env` |

## License

ISC (see `package.json`).
