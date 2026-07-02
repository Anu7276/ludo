#!/bin/bash
cd "$(dirname "$0")"
while true; do
  # Wait for port to be free
  while lsof -i:3003 >/dev/null 2>&1; do
    sleep 0.5
  done
  bun index.ts
  echo "[Ludo] Service exited, restarting in 1s... ($(date))" >> /tmp/ludo-service.log
  sleep 1
done