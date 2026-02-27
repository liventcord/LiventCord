#!/bin/sh
mkdir -p /app/data /app/Logs
chown -R appuser:appgroup /app
exec su-exec appuser ./LiventCord