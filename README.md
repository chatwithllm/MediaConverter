# TranscodePipelineDash

Live dashboard for the TrueNAS → Plex transcode pipeline.

## Dev

Requires Node 22 and npm.

```sh
nvm use
npm install
npm run dev:backend   # in one terminal
npm run dev:frontend  # in another
```

Backend listens on `http://localhost:3100` by default.
Frontend dev server runs on `http://localhost:5173` and proxies `/api` to the backend.
