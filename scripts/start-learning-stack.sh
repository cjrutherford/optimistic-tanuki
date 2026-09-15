#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STACK_ID="${LEARNING_STACK_ID:-learning-review-$(printf '%s' "$ROOT_DIR" | sha256sum | cut -c1-8)}"
RUNTIME_DIR="${LEARNING_STACK_RUNTIME_DIR:-$ROOT_DIR/tmp/learning-stack/$STACK_ID}"
INVOCATION_ID="${LEARNING_STACK_INVOCATION_ID:-$(date +%s)-$$}"
LOCK_DIR="${RUNTIME_DIR}.lock"
INVOCATION_DIR="$RUNTIME_DIR/invocations/$INVOCATION_ID"
PID_DIR="$INVOCATION_DIR/pids"
LOG_DIR="$INVOCATION_DIR/logs"
COOKIE_JAR="$INVOCATION_DIR/smoke.cookies"
ENV_DIR="$INVOCATION_DIR/env"
RESPONSE_FILE="$INVOCATION_DIR/response.json"
SMOKE_AUTH_CONFIG="$INVOCATION_DIR/smoke-auth.curl"
APP_REGISTRY_PATH="${APP_REGISTRY_PATH:-}"
RUNNER_RESOURCE_SUFFIX="$(printf '%s' "$ROOT_DIR|$STACK_ID|$INVOCATION_ID" | sha256sum | cut -c1-16)"
RUNNER_CONTAINER_NAME="${LEARNING_RUNNER_CONTAINER_NAME:-ot-learning-runner-$RUNNER_RESOURCE_SUFFIX}"
RUNNER_NETWORK_NAME="${LEARNING_RUNNER_NETWORK_NAME:-ot-learning-runner-net-$RUNNER_RESOURCE_SUFFIX}"
RUNNER_IMAGE="${LEARNING_RUNNER_IMAGE:-learning-runner-review:$RUNNER_RESOURCE_SUFFIX}"
RUNNER_CONTAINER_ID=''
RUNNER_NETWORK_ID=''
RUNNER_CONTAINER_IP=''
RUNNER_PROXY_PID=''
RUNNER_IMAGE_OWNED=false
RUNNER_META="$PID_DIR/learning-runner.docker.meta"

umask 077

POSTGRES_HOST="${POSTGRES_HOST:-127.0.0.1}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"

AUTHENTICATION_PORT="${AUTHENTICATION_PORT:-3101}"
PROFILE_PORT="${PROFILE_PORT:-3102}"
PERMISSIONS_PORT="${PERMISSIONS_PORT:-3112}"
AUTH_HTTP_PORT="${AUTH_HTTP_PORT:-3199}"
LEARNING_SERVICE_PORT="${LEARNING_SERVICE_PORT:-3124}"
LEARNING_RUNNER_PORT="${LEARNING_RUNNER_PORT:-3125}"
GATEWAY_PORT="${GATEWAY_PORT:-3005}"
FRONTEND_PORT="${FRONTEND_PORT:-8109}"
SOCKET_PORT="${SOCKET_PORT:-3305}"
SOCIAL_SOCKET_PORT="${SOCIAL_SOCKET_PORT:-3306}"
REVIEW_MODE="${LEARNING_STACK_MODE:-production}"
die() {
  printf 'learning stack: %s\n' "$*" >&2
  exit 1
}

derive_review_host() {
  local candidate
  local candidates
  candidates="$(hostname -I 2>/dev/null || true)"
  for candidate in $candidates; do
    if [[ "$candidate" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] &&
      [[ "$candidate" != 127.* ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

if [[ -n "${LEARNING_REVIEW_HOST:-}" ]]; then
  REVIEW_PUBLIC_HOST="$LEARNING_REVIEW_HOST"
elif [[ "${LEARNING_REVIEW_DERIVE_HOST:-true}" == 'true' ]]; then
  REVIEW_PUBLIC_HOST="$(derive_review_host)" ||
    die 'LEARNING_REVIEW_HOST is required when no non-loopback host can be derived'
else
  die 'LEARNING_REVIEW_HOST is required when host derivation is disabled'
fi
[[ "$REVIEW_PUBLIC_HOST" =~ ^[A-Za-z0-9._:-]+$ ]] ||
  die "invalid LEARNING_REVIEW_HOST: $REVIEW_PUBLIC_HOST"
REVIEW_PUBLIC_ORIGIN="${LEARNING_REVIEW_ORIGIN:-http://$REVIEW_PUBLIC_HOST:$FRONTEND_PORT}"
if [[ -n "${LEARNING_REVIEW_COOKIE_SECURE:-}" ]]; then
  REVIEW_COOKIE_SECURE="$LEARNING_REVIEW_COOKIE_SECURE"
elif [[ "$REVIEW_PUBLIC_ORIGIN" == http://* ]]; then
  REVIEW_COOKIE_SECURE='false'
else
  REVIEW_COOKIE_SECURE='true'
fi
[[ "$REVIEW_COOKIE_SECURE" == 'true' || "$REVIEW_COOKIE_SECURE" == 'false' ]] ||
  die 'LEARNING_REVIEW_COOKIE_SECURE must be true or false'
ALLOWED_HOSTS="${LEARNING_ALLOWED_HOSTS:-localhost,127.0.0.1,$REVIEW_PUBLIC_HOST}"
REVIEW_CLEANUP_EMAILS="${LEARNING_REVIEW_CLEANUP_EMAILS:-}"

declare -a STARTED_SESSIONS=()
SMOKE_EMAIL=''

case "$REVIEW_MODE" in
  production|development) ;;
  *) die "LEARNING_STACK_MODE must be production or development" ;;
esac

generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
    return
  fi
  if command -v od >/dev/null 2>&1; then
    od -An -N32 -tx1 /dev/urandom | tr -d '[:space:]'
    return
  fi
  die 'openssl or od is required to generate review secrets'
}

validate_secret() {
  local name="$1"
  local value="$2"
  local byte_count
  byte_count="$(printf '%s' "$value" | LC_ALL=C wc -c)"
  [[ "$byte_count" -ge 32 ]] ||
    die "$name must contain at least 32 bytes"
}

JWT_SECRET="${JWT_SECRET:-${REVIEW_JWT_SECRET:-}}"
[[ -n "$JWT_SECRET" ]] || JWT_SECRET="$(generate_secret)"
OAUTH_STATE_SECRET="${OAUTH_STATE_SECRET:-$(generate_secret)}"
validate_secret JWT_SECRET "$JWT_SECRET"
validate_secret OAUTH_STATE_SECRET "$OAUTH_STATE_SECRET"
[[ "$JWT_SECRET" != "$OAUTH_STATE_SECRET" ]] ||
  die 'JWT_SECRET and OAUTH_STATE_SECRET must be separate values'

if [[ "$REVIEW_MODE" == 'production' ]]; then
  REVIEW_NODE_ENV='production'
  REQUIRE_HASHED_ASSETS='true'
else
  REVIEW_NODE_ENV='development'
  REQUIRE_HASHED_ASSETS='false'
fi

if [[ -n "${CORS_ALLOWED_ORIGINS:-}" ]]; then
  REVIEW_CORS_ALLOWED_ORIGINS="$CORS_ALLOWED_ORIGINS"
else
  REVIEW_CORS_ALLOWED_ORIGINS="http://localhost:8084,http://localhost:$FRONTEND_PORT,http://127.0.0.1:$FRONTEND_PORT,$REVIEW_PUBLIC_ORIGIN"
fi

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  die "stack lock is held: $LOCK_DIR"
fi
printf '%s\n' "$$" >"$LOCK_DIR/pid"

session_name() {
  printf '%s-%s-%s' "$STACK_ID" "$INVOCATION_ID" "$1"
}

has_session() {
  tmux has-session -t "$1" 2>/dev/null
}

port_is_listening() {
  ss -ltnH 2>/dev/null |
    awk '{print $4}' |
    grep -Eq "(^|:)${1}$"
}

assert_ports_free() {
  local port
  for port in "$@"; do
    if port_is_listening "$port"; then
      die "port $port is occupied; refusing to start stack $STACK_ID"
    fi
  done
}

assert_owned_process() {
  local session="$1"
  local pid="$2"
  local expected="$3"
  local cwd
  local command
  local pane_metadata

  if [[ "$pid" == 'pending' ]]; then
    local pane_pid
    local pane_cwd
    local pane_command
    IFS='|' read -r pane_pid pane_cwd pane_command < <(
      tmux display-message -p -t "$session" \
        '#{pane_pid}|#{pane_current_path}|#{pane_start_command}' 2>/dev/null
    ) || die "cannot inspect pending tmux ownership for $session"
    [[ "$pane_pid" =~ ^[0-9]+$ ]] || die "pending session $session has no pid"
    pid="$pane_pid"
    pane_metadata="$pane_cwd|$pane_command"
  else
    pane_metadata="$(
      tmux display-message -p -t "$session" '#{pane_current_path}|#{pane_start_command}' 2>/dev/null
    )" || die "cannot inspect tmux ownership for $session"
  fi
  [[ "$pane_metadata" == "$ROOT_DIR|"* ]] ||
    die "refusing to manage $session: tmux cwd is not this worktree"
  [[ "$pane_metadata" == *"$expected"* ]] ||
    die "refusing to manage $session: tmux command is not owned by this stack"

  if [[ "${LEARNING_STACK_TEST_MODE:-false}" == 'true' ]]; then
    return
  fi

  cwd="$(readlink "/proc/$pid/cwd" 2>/dev/null || true)"
  command="$(tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null || true)"
  [[ "$cwd" == "$ROOT_DIR" ]] ||
    die "refusing to manage $session: pid $pid cwd is not this worktree"
  [[ "$command" == *"$expected"* ]] ||
    die "refusing to manage $session: pid $pid command is not owned by this stack"
}

stop_session() {
  local role="$1"
  local session
  local pid
  local expected
  session="$(session_name "$role")"
  [[ -f "$PID_DIR/$role.meta" ]] || return
  IFS='|' read -r pid expected <"$PID_DIR/$role.meta"
  if has_session "$session"; then
    assert_owned_process "$session" "$pid" "$expected"
    tmux kill-session -t "$session"
  fi
  rm -f "$PID_DIR/$role.meta"
}

stop_started_sessions() {
  local index
  for ((index = ${#STARTED_SESSIONS[@]} - 1; index >= 0; index--)); do
    stop_session "${STARTED_SESSIONS[index]}"
  done
}

start_runner_container() {
  command -v docker >/dev/null 2>&1 ||
    die 'docker is required for the isolated learning runner'

  if docker container inspect "$RUNNER_CONTAINER_NAME" >/dev/null 2>&1; then
    die "runner container already exists: $RUNNER_CONTAINER_NAME"
  fi
  if docker network inspect "$RUNNER_NETWORK_NAME" >/dev/null 2>&1; then
    die "runner network already exists: $RUNNER_NETWORK_NAME"
  fi

  if [[ -z "${LEARNING_RUNNER_IMAGE:-}" ]]; then
    if docker image inspect "$RUNNER_IMAGE" >/dev/null 2>&1; then
      die "runner image tag already exists: $RUNNER_IMAGE"
    fi
    docker build \
      --file "$ROOT_DIR/apps/learning-runner/Dockerfile" \
      --tag "$RUNNER_IMAGE" \
      --label "optimistic-tanuki.worktree=$ROOT_DIR" \
      --label "optimistic-tanuki.stack=$STACK_ID" \
      --label "optimistic-tanuki.invocation=$INVOCATION_ID" \
      "$ROOT_DIR" ||
      die "could not build runner image $RUNNER_IMAGE"
    RUNNER_IMAGE_OWNED=true
  elif ! docker image inspect "$RUNNER_IMAGE" >/dev/null 2>&1; then
    die "configured runner image does not exist: $RUNNER_IMAGE"
  fi

  RUNNER_NETWORK_ID="$(
    docker network create \
      --driver bridge \
      --internal \
      --label "optimistic-tanuki.worktree=$ROOT_DIR" \
      --label "optimistic-tanuki.stack=$STACK_ID" \
      --label "optimistic-tanuki.invocation=$INVOCATION_ID" \
      "$RUNNER_NETWORK_NAME"
  )" || die "could not create runner network $RUNNER_NETWORK_NAME"
  printf '|%s|%s|%s|||%s|%s\n' \
    "$RUNNER_CONTAINER_NAME" "$RUNNER_NETWORK_ID" "$RUNNER_NETWORK_NAME" \
    "$RUNNER_IMAGE" "$RUNNER_IMAGE_OWNED" >"$RUNNER_META"
  chmod 600 "$RUNNER_META"

  RUNNER_CONTAINER_ID="$(
    docker run --detach \
      --name "$RUNNER_CONTAINER_NAME" \
      --network "$RUNNER_NETWORK_NAME" \
      --user 1000:1000 \
      --read-only \
      --tmpfs '/tmp:size=16m,noexec,nosuid,nodev' \
      --tmpfs '/scratch:size=192m,exec,nosuid,nodev,mode=1777' \
      --cap-drop ALL \
      --security-opt no-new-privileges:true \
      --pids-limit 32 \
      --memory 256m \
      --memory-swap 256m \
      --env PORT=3025 \
      --env LEARNING_SCRATCH_DIR=/scratch \
      --env LEARNING_RUNNER_PROCESS_LIMIT=32 \
      --env LEARNING_RUNNER_CPU_LIMIT_SECONDS=10 \
      --env LEARNING_RUNNER_GO_CONCURRENCY=1 \
      --env LEARNING_RUNNER_COMPILE_TIMEOUT_MS=30000 \
      --label "optimistic-tanuki.worktree=$ROOT_DIR" \
      --label "optimistic-tanuki.stack=$STACK_ID" \
      --label "optimistic-tanuki.invocation=$INVOCATION_ID" \
      "$RUNNER_IMAGE"
  )" || die "could not start runner container $RUNNER_CONTAINER_NAME"

  RUNNER_CONTAINER_IP="$(
    docker inspect \
      --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' \
      "$RUNNER_CONTAINER_ID"
  )" || die "could not determine runner container address"
  [[ "$RUNNER_CONTAINER_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] ||
    die "runner container returned an invalid address: $RUNNER_CONTAINER_IP"

  if [[ "${LEARNING_STACK_TEST_MODE:-false}" != 'true' ]]; then
    command -v socat >/dev/null 2>&1 ||
      die 'socat is required for the loopback-only runner proxy'
    socat \
      "TCP-LISTEN:$LEARNING_RUNNER_PORT,bind=127.0.0.1,reuseaddr,fork" \
      "TCP:$RUNNER_CONTAINER_IP:3025" &
    RUNNER_PROXY_PID=$!
    sleep 0.2
    kill -0 "$RUNNER_PROXY_PID" 2>/dev/null ||
      die 'runner loopback proxy exited during startup'
  fi

  printf '%s|%s|%s|%s|%s|%s|%s|%s\n' \
    "$RUNNER_CONTAINER_ID" "$RUNNER_CONTAINER_NAME" \
    "$RUNNER_NETWORK_ID" "$RUNNER_NETWORK_NAME" \
    "$RUNNER_CONTAINER_IP" "$RUNNER_PROXY_PID" "$RUNNER_IMAGE" \
    "$RUNNER_IMAGE_OWNED" >"$RUNNER_META"
  chmod 600 "$RUNNER_META"

  for attempt in {1..60}; do
    if docker exec "$RUNNER_CONTAINER_ID" \
      curl --fail --silent --show-error --max-time 2 \
      http://127.0.0.1:3025/health >/dev/null 2>&1; then
      return
    fi
    [[ "$attempt" -eq 60 ]] &&
      die 'learning runner did not become healthy inside its container'
    sleep 1
  done
}

stop_runner_container() {
  [[ -f "$RUNNER_META" ]] || return 0

  local container_id
  local container_name
  local network_id
  local network_name
  local container_ip
  local proxy_pid
  local image
  local image_owned
  IFS='|' read -r \
    container_id container_name network_id network_name container_ip proxy_pid \
    image image_owned \
    <"$RUNNER_META"

  if [[ -n "$proxy_pid" ]]; then
    local proxy_command
    proxy_command="$(tr '\0' ' ' <"/proc/$proxy_pid/cmdline" 2>/dev/null || true)"
    [[ "$proxy_command" == *"TCP-LISTEN:$LEARNING_RUNNER_PORT"* ]] &&
      [[ "$proxy_command" == *"TCP:$container_ip:3025"* ]] ||
      die "refusing to stop an unowned runner proxy: $proxy_pid"
    kill "$proxy_pid" 2>/dev/null ||
      die "could not stop runner proxy $proxy_pid"
  fi

  if [[ -n "$container_id" ]] &&
    docker container inspect "$container_id" >/dev/null 2>&1; then
    local current_name
    current_name="$(
      docker container inspect \
        --format '{{.Name}}' "$container_id" 2>/dev/null || true
    )"
    [[ "$current_name" == "/$container_name" ]] ||
      die "refusing to remove an unowned runner container: $container_id"
    docker rm --force "$container_id" >/dev/null ||
      die "could not remove runner container $container_id"
  fi

  if docker network inspect "$network_id" >/dev/null 2>&1; then
    local current_network_name
    current_network_name="$(
      docker network inspect \
        --format '{{.Name}}' "$network_id" 2>/dev/null || true
    )"
    [[ "$current_network_name" == "$network_name" ]] ||
      die "refusing to remove an unowned runner network: $network_id"
    docker network rm "$network_id" >/dev/null ||
      die "could not remove runner network $network_id"
  fi

  if [[ "$image_owned" == 'true' ]] &&
    docker image inspect "$image" >/dev/null 2>&1; then
    docker image rm "$image" >/dev/null ||
      die "could not remove runner image $image"
  fi
  rm -f "$RUNNER_META"
}

cleanup_unrecorded_runner_image() {
  if [[ "$RUNNER_IMAGE_OWNED" == 'true' ]] &&
    docker image inspect "$RUNNER_IMAGE" >/dev/null 2>&1; then
    docker image rm "$RUNNER_IMAGE" >/dev/null ||
      die "could not remove runner image $RUNNER_IMAGE"
  fi
}

cleanup_smoke_identity() {
  if [[ -z "$SMOKE_EMAIL" ]]; then
    return 0
  fi
  local smoke_user_id
  local smoke_profile_id
  local cleanup_failed=0
  smoke_user_id=''
  smoke_profile_id=''
  if ! smoke_user_id="$(
    PGPASSWORD="$POSTGRES_PASSWORD" psql -At \
      -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" \
      -d ot_authentication -v email="$SMOKE_EMAIL" \
      <<'SQL' 2>/dev/null
SELECT id FROM user_entity WHERE email = :'email' LIMIT 1;
SQL
  )"; then
    cleanup_failed=1
    smoke_user_id=''
  fi
  smoke_user_id="$(printf '%s' "$smoke_user_id" | tr -d '[:space:]')"
  if ! PGPASSWORD="$POSTGRES_PASSWORD" psql \
    -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" \
    -d ot_authentication -v ON_ERROR_STOP=1 -v email="$SMOKE_EMAIL" <<'SQL' >/dev/null 2>&1
UPDATE user_entity SET "keyDataId" = NULL WHERE email = :'email';
DELETE FROM token WHERE "userId" IN (SELECT id FROM user_entity WHERE email = :'email');
DELETE FROM auth_action_token WHERE "userId" IN (SELECT id FROM user_entity WHERE email = :'email');
DELETE FROM key_datum WHERE "userId" IN (SELECT id FROM user_entity WHERE email = :'email');
DELETE FROM user_entity WHERE email = :'email';
SQL
  then
    cleanup_failed=1
  fi
  if [[ -n "$smoke_user_id" ]]; then
    if ! smoke_profile_id="$(
      PGPASSWORD="$POSTGRES_PASSWORD" psql -At \
        -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" \
        -d ot_profile -v user_id="$smoke_user_id" \
        <<'SQL' 2>/dev/null
SELECT id FROM profile WHERE "userId" = :'user_id' LIMIT 1;
SQL
    )"; then
      cleanup_failed=1
      smoke_profile_id=''
    fi
    smoke_profile_id="$(printf '%s' "$smoke_profile_id" | tr -d '[:space:]')"
    if [[ -n "$smoke_profile_id" ]]; then
      if ! PGPASSWORD="$POSTGRES_PASSWORD" psql \
        -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" \
        -d ot_permissions -v profile_id="$smoke_profile_id" <<'SQL' >/dev/null 2>&1
DELETE FROM role_assignment WHERE "profileId" = :'profile_id';
SQL
      then
        cleanup_failed=1
      fi
    fi
    if ! PGPASSWORD="$POSTGRES_PASSWORD" psql \
      -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" \
      -d ot_profile -v ON_ERROR_STOP=1 -v user_id="$smoke_user_id" <<'SQL' >/dev/null 2>&1
DELETE FROM profile WHERE "userId" = :'user_id';
SQL
    then
      cleanup_failed=1
    fi
  fi
  if [[ -n "$smoke_user_id" ]] &&
    ! PGPASSWORD="$POSTGRES_PASSWORD" psql \
      -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" \
      -d ot_learning_service -v ON_ERROR_STOP=1 \
      -v user_id="$smoke_user_id" <<'SQL' >/dev/null 2>&1
DELETE FROM lp_evaluation
 WHERE "attemptId" IN (
   SELECT id FROM lp_attempt WHERE "userId" = :'user_id'
 );
DELETE FROM lp_credit_ledger_entry WHERE "userId" = :'user_id';
DELETE FROM lp_attempt WHERE "userId" = :'user_id';
SQL
  then
    cleanup_failed=1
  fi
  if [[ -n "$smoke_profile_id" ]] &&
    ! PGPASSWORD="$POSTGRES_PASSWORD" psql \
      -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" \
      -d ot_learning_service -v ON_ERROR_STOP=1 \
      -v profile_id="$smoke_profile_id" <<'SQL' >/dev/null 2>&1
DELETE FROM lp_lesson_progress WHERE "profileId" = :'profile_id';
DELETE FROM lp_enrolment WHERE "profileId" = :'profile_id';
DELETE FROM lp_offering_ownership WHERE "ownerProfileId" = :'profile_id';
SQL
  then
    cleanup_failed=1
  fi
  if ! rm -f "$COOKIE_JAR"; then
    cleanup_failed=1
  fi
  if ! rm -f "$INVOCATION_DIR"/smoke-*.json; then
    cleanup_failed=1
  fi
  SMOKE_EMAIL=''
  return "$cleanup_failed"
}

cleanup_marked_identities() {
  if [[ -z "$REVIEW_CLEANUP_EMAILS" ]]; then
    return 0
  fi

  local saved_email="$SMOKE_EMAIL"
  local email
  local cleanup_failed=0
  IFS=',' read -ra marked_emails <<<"$REVIEW_CLEANUP_EMAILS"
  for email in "${marked_emails[@]}"; do
    email="${email#"${email%%[![:space:]]*}"}"
    email="${email%"${email##*[![:space:]]}"}"
    case "$email" in
      learning-review-*|secure-*) ;;
      *) continue ;;
    esac
    SMOKE_EMAIL="$email"
    cleanup_smoke_identity || cleanup_failed=1
  done
  SMOKE_EMAIL="$saved_email"
  return "$cleanup_failed"
}

cleanup_secret_files() {
  local cleanup_failed=0
  rm -f \
    "$INVOCATION_DIR/authentication.yaml" \
    "$COOKIE_JAR" \
    "$RESPONSE_FILE" \
    "$SMOKE_AUTH_CONFIG" ||
    cleanup_failed=1
  if [[ -n "$APP_REGISTRY_PATH" ]]; then
    rm -f "$APP_REGISTRY_PATH" || cleanup_failed=1
  fi
  rm -f "$INVOCATION_DIR"/smoke-*.json || cleanup_failed=1
  rm -f "$ENV_DIR"/*.env 2>/dev/null || true
  return "$cleanup_failed"
}

cleanup_lock() {
  rm -rf "$LOCK_DIR" || true
}

cleanup_invocation_dir() {
  rm -rf "$INVOCATION_DIR" || true
}

on_exit() {
  local status="$?"
  if ! cleanup_smoke_identity; then
    printf 'learning stack: smoke identity cleanup failed\n' >&2
    [[ "$status" -eq 0 ]] && status=1
  fi
  if ! cleanup_marked_identities; then
    printf 'learning stack: marked identity cleanup failed\n' >&2
    [[ "$status" -eq 0 ]] && status=1
  fi
  if ! cleanup_secret_files; then
    printf 'learning stack: secret file cleanup failed\n' >&2
    [[ "$status" -eq 0 ]] && status=1
  fi
  cleanup_lock
  if [[ "$status" -ne 0 ]]; then
    stop_runner_container
    cleanup_unrecorded_runner_image
    stop_started_sessions
    cleanup_invocation_dir
  fi
  exit "$status"
}
trap on_exit EXIT

mkdir -p "$PID_DIR" "$LOG_DIR" "$INVOCATION_DIR/scratch" "$ENV_DIR"
assert_ports_free \
  "$AUTHENTICATION_PORT" "$PROFILE_PORT" "$PERMISSIONS_PORT" "$AUTH_HTTP_PORT" \
  "$LEARNING_SERVICE_PORT" "$LEARNING_RUNNER_PORT" "$GATEWAY_PORT" "$FRONTEND_PORT" \
  "$SOCKET_PORT" "$SOCIAL_SOCKET_PORT"

POSTGRES_HOST="$POSTGRES_HOST" \
POSTGRES_PORT="$POSTGRES_PORT" \
POSTGRES_USER="$POSTGRES_USER" \
POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
AUTHENTICATION_PORT="$AUTHENTICATION_PORT" \
  node "$ROOT_DIR/scripts/lib/learning-auth-config.mjs" >"$INVOCATION_DIR/authentication.yaml"
chmod 600 "$INVOCATION_DIR/authentication.yaml"

write_env_value() {
  printf '%s=%q\n' "$1" "$2" >>"$ENV_FILE"
}

write_env_file() {
  local role="$1"
  ENV_FILE="$ENV_DIR/$role.env"
  : >"$ENV_FILE"
  write_env_value POSTGRES_HOST "$POSTGRES_HOST"
  write_env_value POSTGRES_PORT "$POSTGRES_PORT"
  write_env_value POSTGRES_USER "$POSTGRES_USER"
  write_env_value POSTGRES_PASSWORD "$POSTGRES_PASSWORD"
  write_env_value DATABASE_HOST "$POSTGRES_HOST"
  write_env_value DATABASE_PORT "$POSTGRES_PORT"
  write_env_value DATABASE_USER "$POSTGRES_USER"
  write_env_value DATABASE_PASSWORD "$POSTGRES_PASSWORD"
  write_env_value JWT_SECRET "$JWT_SECRET"
  write_env_value AUTH_COOKIE_SECURE "$REVIEW_COOKIE_SECURE"
  write_env_value AUTHENTICATION_CONFIG_PATH "$INVOCATION_DIR/authentication.yaml"
  write_env_value AUTH_AUTO_VERIFY_EMAILS true
  write_env_value BOOTSTRAP_HTTP_HOST 127.0.0.1
  write_env_value BOOTSTRAP_HTTP_PORT "$AUTH_HTTP_PORT"
  write_env_value AUTHENTICATION_PORT "$AUTHENTICATION_PORT"
  write_env_value PROFILE_PORT "$PROFILE_PORT"
  write_env_value PERMISSIONS_PORT "$PERMISSIONS_PORT"
  write_env_value LEARNING_SERVICE_PORT "$LEARNING_SERVICE_PORT"
  write_env_value LEARNING_RUNNER_PORT "$LEARNING_RUNNER_PORT"
  write_env_value GATEWAY_PORT "$GATEWAY_PORT"
  write_env_value FRONTEND_PORT "$FRONTEND_PORT"
  write_env_value SOCKET_PORT "$SOCKET_PORT"
  write_env_value SOCIAL_SOCKET_PORT "$SOCIAL_SOCKET_PORT"
  write_env_value ALLOWED_HOSTS "$ALLOWED_HOSTS"
  write_env_value CORS_ALLOWED_ORIGINS "$REVIEW_CORS_ALLOWED_ORIGINS"
  write_env_value OAUTH_STATE_SECRET "$OAUTH_STATE_SECRET"
  if [[ -n "$APP_REGISTRY_PATH" ]]; then
    write_env_value APP_REGISTRY_PATH "$APP_REGISTRY_PATH"
  fi
  write_env_value AUTHENTICATION_HOST 127.0.0.1
  write_env_value PROFILE_HOST 127.0.0.1
  write_env_value PERMISSIONS_HOST 127.0.0.1
  write_env_value LEARNING_SERVICE_HOST 127.0.0.1
  write_env_value REDIS_HOST 127.0.0.1
  write_env_value REDIS_PORT 6379
  chmod 600 "$ENV_FILE"
}

if [[ "$REVIEW_MODE" == 'production' && -z "$APP_REGISTRY_PATH" ]]; then
  APP_REGISTRY_PATH="$INVOCATION_DIR/app-registry.json"
  node --input-type=module - \
    "$ROOT_DIR/libs/app-registry-backend/src/lib/default-registry.json" \
    "$APP_REGISTRY_PATH" "$REVIEW_PUBLIC_ORIGIN" <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs';

const [sourcePath, targetPath, reviewOrigin] = process.argv.slice(2);
const registry = JSON.parse(readFileSync(sourcePath, 'utf8'));
const learningApp = registry.apps?.find((app) => app.appId === 'learning');
if (!learningApp) {
  throw new Error('learning app is missing from the default app registry');
}
learningApp.uiBaseUrl = reviewOrigin;
learningApp.iconUrl = `${reviewOrigin}/favicon.ico`;
writeFileSync(targetPath, `${JSON.stringify(registry)}\n`, { mode: 0o600 });
NODE
  chmod 600 "$APP_REGISTRY_PATH"
fi

for role in authentication profile permissions learning-runner learning-service gateway frontend; do
  write_env_file "$role"
done

for service in authentication profile permissions; do
  case "$service" in
    authentication) database='ot_authentication' ;;
    profile) database='ot_profile' ;;
    permissions) database='ot_permissions' ;;
  esac
  POSTGRES_HOST="$POSTGRES_HOST" \
  POSTGRES_PORT="$POSTGRES_PORT" \
  POSTGRES_USER="$POSTGRES_USER" \
  POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  POSTGRES_DB="$database" \
  NX_DAEMON=false \
  NX_ISOLATE_PLUGINS=false \
    pnpm exec nx run "$service:typeorm:migration:run"
done

# The default review runtime is deliberately built in production mode so the
# gateway, learning service, and SSR browser server all start from one
# current artifact set. Set LEARNING_STACK_MODE=development for local opt-in.
NX_DAEMON=false NX_ISOLATE_PLUGINS=false \
  pnpm exec nx run-many --target=build \
  --projects=authentication,profile,permissions,gateway,learning-service,learning \
  --configuration="$REVIEW_MODE" --parallel=6

for artifact in \
  "$ROOT_DIR/dist/apps/gateway/main.js" \
  "$ROOT_DIR/dist/apps/learning/server/server.mjs" \
  "$ROOT_DIR/dist/apps/learning/browser/index.csr.html" \
  "$ROOT_DIR/dist/apps/learning-service/main.js"; do
  [[ -f "$artifact" ]] || die "missing build artifact $artifact"
done

DATABASE_HOST="$POSTGRES_HOST" \
DATABASE_PORT="$POSTGRES_PORT" \
DATABASE_USER="$POSTGRES_USER" \
DATABASE_PASSWORD="$POSTGRES_PASSWORD" \
DATABASE_NAME=ot_permissions \
POSTGRES_DB=ot_permissions \
  node "$ROOT_DIR/dist/apps/permissions/seed-permissions.js"

seed_count="$(
  PGPASSWORD="$POSTGRES_PASSWORD" psql -At \
    -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" \
    -d ot_permissions -c \
    "SELECT COUNT(*) FROM app_scope WHERE name = 'learning';"
)"
[[ "$seed_count" == '1' ]] || die 'canonical learning app scope was not seeded'
role_count="$(
  PGPASSWORD="$POSTGRES_PASSWORD" psql -At \
    -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" \
    -d ot_permissions -c \
    "SELECT COUNT(*) FROM role WHERE name IN ('learning_learner','learning_course_designer','learning_course_editor','learning_admin');"
)"
[[ "$role_count" == '4' ]] || die 'canonical learning roles were not seeded'

start_session() {
  local role="$1"
  local expected="$2"
  local command="$3"
  local session
  local pid
  session="$(session_name "$role")"
  has_session "$session" && die "tmux session $session already exists"
  tmux new-session -d -s "$session" -c "$ROOT_DIR" "$command"
  STARTED_SESSIONS+=("$role")
  printf 'pending|%s\n' "$expected" >"$PID_DIR/$role.meta"
  sleep 0.2
  pid="$(tmux list-panes -t "$session" -F '#{pane_pid}' | head -n 1)"
  [[ "$pid" =~ ^[0-9]+$ ]] || die "could not find pid for $session"
  assert_owned_process "$session" "$pid" "$expected"
  printf '%s|%s\n' "$pid" "$expected" >"$PID_DIR/$role.meta"
}

start_session authentication 'dist/apps/authentication/main.js' \
  "set -eu; set -a; . $ENV_DIR/authentication.env; set +a; rm -f $ENV_DIR/authentication.env; export NODE_ENV=$REVIEW_NODE_ENV; exec node dist/apps/authentication/main.js"
start_session profile 'dist/apps/profile/main.js' \
  "set -eu; set -a; . $ENV_DIR/profile.env; set +a; rm -f $ENV_DIR/profile.env; export NODE_ENV=$REVIEW_NODE_ENV LISTEN_PORT=$PROFILE_PORT DATABASE_NAME=ot_profile SERVICE_PERMISSIONS_HOST=127.0.0.1 SERVICE_PERMISSIONS_PORT=$PERMISSIONS_PORT; exec node dist/apps/profile/main.js"
start_session permissions 'dist/apps/permissions/main.js' \
  "set -eu; set -a; . $ENV_DIR/permissions.env; set +a; rm -f $ENV_DIR/permissions.env; export NODE_ENV=$REVIEW_NODE_ENV LISTEN_PORT=$PERMISSIONS_PORT DATABASE_NAME=ot_permissions; exec node dist/apps/permissions/main.js"
start_runner_container
start_session learning-service 'dist/apps/learning-service/main.js' \
  "set -eu; set -a; . $ENV_DIR/learning-service.env; set +a; rm -f $ENV_DIR/learning-service.env; export NODE_ENV=$REVIEW_NODE_ENV LISTEN_PORT=$LEARNING_SERVICE_PORT DATABASE_NAME=ot_learning_service LEARNING_CONTENT_ROOT=$ROOT_DIR/apps/learning-service/src/assets/content LEARNING_RUNNER_URL=http://127.0.0.1:$LEARNING_RUNNER_PORT; exec node dist/apps/learning-service/main.js"
start_session gateway 'dist/apps/gateway/main.js' \
  "set -eu; set -a; . $ENV_DIR/gateway.env; set +a; rm -f $ENV_DIR/gateway.env; export NODE_ENV=$REVIEW_NODE_ENV LISTEN_PORT=$GATEWAY_PORT PORT=$GATEWAY_PORT REDIS_HOST=127.0.0.1 REDIS_PORT=6379 AUTHENTICATION_HOST=127.0.0.1 PROFILE_HOST=127.0.0.1 PERMISSIONS_HOST=127.0.0.1 LEARNING_SERVICE_HOST=127.0.0.1; exec node dist/apps/gateway/main.js"
start_session frontend 'dist/apps/learning/server/server.mjs' \
  "set -eu; set -a; . $ENV_DIR/frontend.env; set +a; rm -f $ENV_DIR/frontend.env; export NODE_ENV=$REVIEW_NODE_ENV PORT=$FRONTEND_PORT GATEWAY_URL=http://127.0.0.1:$GATEWAY_PORT NG_ALLOWED_HOSTS=$ALLOWED_HOSTS; exec node dist/apps/learning/server/server.mjs"

for entry in \
  "authentication|$AUTH_HTTP_PORT" \
  "profile|$PROFILE_PORT" \
  "permissions|$PERMISSIONS_PORT" \
  "learning-service|$LEARNING_SERVICE_PORT" \
  "gateway|$GATEWAY_PORT" \
  "frontend|$FRONTEND_PORT" \
  "gateway-socket|$SOCKET_PORT" \
  "social-socket|$SOCIAL_SOCKET_PORT"; do
  IFS='|' read -r name port <<<"$entry"
  for attempt in {1..60}; do
    if port_is_listening "$port"; then break; fi
    [[ "$attempt" -eq 60 ]] && die "$name did not become ready on port $port"
    sleep 1
  done
done

curl --fail --silent --show-error --max-time 10 \
  "http://127.0.0.1:$AUTH_HTTP_PORT/api/bootstrap/owner/status" >/dev/null ||
  die 'authentication HTTP readiness probe failed'
rm -f "$INVOCATION_DIR/authentication.yaml" ||
  die 'authentication config cleanup failed after readiness'
for attempt in {1..10}; do
  if curl --fail --silent --show-error --max-time 10 \
    "http://127.0.0.1:$FRONTEND_PORT/" >/dev/null; then
    break
  fi
  [[ "$attempt" -eq 10 ]] && die 'frontend readiness probe failed'
  sleep 1
done
LEARNING_REQUIRE_HASHED_ASSETS="$REQUIRE_HASHED_ASSETS" \
  node "$ROOT_DIR/scripts/verify-learning-assets.mjs" \
  "http://127.0.0.1:$FRONTEND_PORT" ||
  die 'frontend asset readiness probe failed'

SMOKE_EMAIL="learning-review-$(printf '%s' "$STACK_ID" | sha256sum | cut -c1-16)-$(date +%s)-$$@example.com"
SMOKE_PASSWORD="ReviewOnly-${STACK_ID}-$(date +%s)-$$!"
export SMOKE_EMAIL
printf '{"email":"%s","password":"%s","confirm":"%s","fn":"Learning","ln":"Review Smoke","bio":""}\n' \
  "$SMOKE_EMAIL" "$SMOKE_PASSWORD" "$SMOKE_PASSWORD" \
  >"$INVOCATION_DIR/smoke-register.json"
printf '{"email":"%s","password":"%s"}\n' \
  "$SMOKE_EMAIL" "$SMOKE_PASSWORD" >"$INVOCATION_DIR/smoke-login.json"
printf '{}\n' >"$INVOCATION_DIR/smoke-logout.json"
chmod 600 "$INVOCATION_DIR"/smoke-*.json
request_status() {
  local expected="$1"
  shift
  local status
  status="$(curl --silent --show-error --max-time 15 "$@" \
    --output "$RESPONSE_FILE" --write-out '%{http_code}')"
  [[ "$status" == "$expected" ]] ||
    die "expected HTTP $expected, received HTTP $status"
}

assert_session_identity() {
  SMOKE_EMAIL="$SMOKE_EMAIL" node --input-type=module - "$RESPONSE_FILE" <<'NODE'
import { readFileSync } from 'node:fs';
const response = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const data = response?.data;
if (data?.email !== process.env.SMOKE_EMAIL || !data?.profileId) {
  process.exit(1);
}
NODE
}

assert_learning_identity() {
  SMOKE_PROFILE_ID="$SMOKE_PROFILE_ID" node --input-type=module - "$RESPONSE_FILE" <<'NODE'
import { readFileSync } from 'node:fs';
const response = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const data = response;
if (
  data?.profileId !== process.env.SMOKE_PROFILE_ID ||
  typeof data?.name !== 'string' ||
  data.name.trim().length === 0
) {
  process.exit(1);
}
NODE
}

AUTH_HEADERS=(
  -H "Content-Type: application/json"
  -H "Origin: http://127.0.0.1:$FRONTEND_PORT"
  -H 'X-ot-app-id: learning'
  -H 'X-ot-appscope: learning'
)
AUTH_LOGIN_HEADERS=("${AUTH_HEADERS[@]}" -H 'X-ot-session-mode: cookie')
if [[ "$REVIEW_MODE" == 'development' ]]; then
  SESSION_AUTH_ARGS=(--cookie "$COOKIE_JAR")
  LOGOUT_AUTH_ARGS=(--cookie "$COOKIE_JAR")
else
  SESSION_AUTH_ARGS=()
  LOGOUT_AUTH_ARGS=()
fi
request_status 201 "${AUTH_HEADERS[@]}" \
  -X POST "http://127.0.0.1:$GATEWAY_PORT/api/authentication/register" \
  --data-binary "@$INVOCATION_DIR/smoke-register.json"
request_status 201 "${AUTH_LOGIN_HEADERS[@]}" \
  -X POST "http://127.0.0.1:$GATEWAY_PORT/api/authentication/login" \
  --cookie-jar "$COOKIE_JAR" --data-binary "@$INVOCATION_DIR/smoke-login.json"
if [[ "$REVIEW_MODE" == 'production' ]]; then
  SMOKE_SESSION_COOKIE="$(
    awk '$6 == "ot_session" { print $7; exit }' "$COOKIE_JAR"
  )"
  [[ -n "$SMOKE_SESSION_COOKIE" ]] ||
    die 'production smoke login did not return a session cookie'
  printf 'header = "Cookie: ot_session=%s"\n' "$SMOKE_SESSION_COOKIE" \
    >"$SMOKE_AUTH_CONFIG"
  unset SMOKE_SESSION_COOKIE
  chmod 600 "$SMOKE_AUTH_CONFIG"
  SESSION_AUTH_ARGS=(--config "$SMOKE_AUTH_CONFIG")
  LOGOUT_AUTH_ARGS=(--config "$SMOKE_AUTH_CONFIG")
fi
request_status 200 -H 'X-ot-appscope: learning' \
  "${SESSION_AUTH_ARGS[@]}" \
  "http://127.0.0.1:$GATEWAY_PORT/api/authentication/session"
assert_session_identity
SMOKE_PROFILE_ID="$(
  node --input-type=module - "$RESPONSE_FILE" <<'NODE'
import { readFileSync } from 'node:fs';
const response = JSON.parse(readFileSync(process.argv[2], 'utf8'));
process.stdout.write(response.data.profileId);
NODE
)"
request_status 200 -H 'X-ot-appscope: learning' \
  "${SESSION_AUTH_ARGS[@]}" \
  "http://127.0.0.1:$GATEWAY_PORT/api/learning/me"
assert_learning_identity
learner_role_count="$(
  PGPASSWORD="$POSTGRES_PASSWORD" psql -At \
    -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" \
    -d ot_permissions -v profile_id="$SMOKE_PROFILE_ID" <<'SQL'
SELECT COUNT(*) FROM role_assignment ra
  JOIN role r ON r.id = ra."roleId"
  JOIN app_scope s ON s.id = ra."appScopeId"
 WHERE ra."profileId" = :'profile_id'
   AND r.name = 'learning_learner'
   AND s.name = 'learning';
SQL
)"
[[ "$learner_role_count" == '1' ]] ||
  die 'smoke identity was not granted learning_learner'
request_status 201 "${AUTH_HEADERS[@]}" \
  -X POST "http://127.0.0.1:$GATEWAY_PORT/api/authentication/logout" \
  "${LOGOUT_AUTH_ARGS[@]}" --data-binary "@$INVOCATION_DIR/smoke-logout.json"
status="$(
  curl --silent --show-error --max-time 15 \
    -H 'X-ot-appscope: learning' "${SESSION_AUTH_ARGS[@]}" \
    -o "$RESPONSE_FILE" --write-out '%{http_code}' \
    "http://127.0.0.1:$GATEWAY_PORT/api/authentication/session"
)"
[[ "$status" == '401' ]] || die "sign-out smoke expected HTTP 401, received HTTP $status"

printf 'learning review stack %s is ready on %s (local http://127.0.0.1:%s)\n' \
  "$STACK_ID" "$REVIEW_PUBLIC_ORIGIN" "$FRONTEND_PORT"
if ! cleanup_smoke_identity; then
  stop_started_sessions
  trap - EXIT
  die 'smoke identity cleanup failed'
fi
if ! cleanup_marked_identities; then
  stop_started_sessions
  trap - EXIT
  die 'marked identity cleanup failed'
fi
if ! cleanup_secret_files; then
  stop_started_sessions
  trap - EXIT
  die 'secret file cleanup failed'
fi
trap - EXIT
