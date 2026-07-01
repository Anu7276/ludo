#!/bin/bash
cd /home/z/my-project/mini-services/ludo-service && bun --hot index.ts &
LUDO_PID=$!
cd /home/z/my-project && bun run dev &
NEXT_PID=$!
echo "Ludo PID: $LUDO_PID"
echo "Next PID: $NEXT_PID"

# Keep script alive
while kill -0 $LUDO_PID 2>/dev/null || kill -0 $NEXT_PID 2>/dev/null; do
  sleep 1
done
echo "Services stopped"