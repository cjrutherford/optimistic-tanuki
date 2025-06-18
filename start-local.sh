#!/bin/bash
# filepath: /home/cjrutherford/workspace/optimistic-tanuki/start-local.sh

set -e
LOGDIR="/home/cjrutherford/workspace/OTlogs"
# Store PIDs
declare -A SERVICE_PIDS

# Start Postgres in Docker
echo "Starting Postgres in Docker..."
docker run --rm -d \
  --name nx-local-postgres \
  -e POSTGRES_PASSWORD=devpassword \
  -e POSTGRES_USER=devuser \
  -e POSTGRES_DB=devdb \
  -p 5432:5432 \
  postgres:16

# Define services and ports
SERVICES=(
  "gateway:3000:9000"
  "authentication:3001:9001"
  "profile:3002:9002"
  "social:3003:9003"
  "tasks:3004:9004"
  "assets:3005:9005"
)

mkdir -p "$LOGDIR"

start_services() {
  echo "Starting Postgres in Docker..."
  docker run --rm -d \
    --name nx-local-postgres \
    -e POSTGRES_PASSWORD=devpassword \
    -e POSTGRES_USER=devuser \
    -e POSTGRES_DB=devdb \
    -p 5432:5432 \
    postgres:16

  echo "" > "$PIDFILE"
  for entry in "${SERVICES[@]}"; do
    IFS=":" read -r NAME PORT DEBUG_PORT <<< "$entry"
    LOGFILE="$LOGDIR/$NAME.log"
    echo "Starting $NAME on port $PORT (debug: $DEBUG_PORT)..."
    nx run $NAME:serve --port=$PORT --inspect=$DEBUG_PORT > "$LOGFILE" 2>&1 &
    PID=$!
    echo "$NAME:$PID" >> "$PIDFILE"
    sleep 1
  done
  echo "All services started."
}

stop_services() {
  if [ -f "$PIDFILE" ]; then
    while IFS=: read -r NAME PID; do
      if kill -0 "$PID" 2>/dev/null; then
        echo "Stopping $NAME (PID $PID)..."
        kill "$PID"
      fi
    done < "$PIDFILE"
    rm "$PIDFILE"
  fi
  docker stop nx-local-postgres
  echo "All services and Postgres stopped."
}

status_services() {
  if [ -f "$PIDFILE" ]; then
    while IFS=: read -r NAME PID; do
      if kill -0 "$PID" 2>/dev/null; then
        echo "$NAME (PID $PID) is running"
      else
        echo "$NAME (PID $PID) is NOT running"
      fi
    done < "$PIDFILE"
  else
    echo "No services running."
  fi
}

logs_services() {
  for entry in "${SERVICES[@]}"; do
    IFS=":" read -r NAME _ <<< "$entry"
    echo "---- $NAME ----"
    tail -n 20 "$LOGDIR/$NAME.log"
  done
}

case "$1" in
  start)
    start_services
    ;;
  stop)
    stop_services
    ;;
  status)
    status_services
    ;;
  logs)
    logs_services
    ;;
  *)
    echo "Usage: $0 {start|stop|status|logs}"
    ;;
esac