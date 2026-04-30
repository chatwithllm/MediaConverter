# transcode-digest

Hourly summary adapter. Reads completed Tdarr jobs since the last run and posts a one-line activity entry to a SmartKanban "Media Pipeline" card.

## Run

One-shot:

    CONFIG_FILE=../backend/data/config.json npm start

Cron (every hour):

    0 * * * *  cd /abs/path/to/digest && CONFIG_FILE=/abs/config.json npm start >> /var/log/digest.log 2>&1

Idempotent — checkpoint at `data/last-run.json` prevents double-posting.
