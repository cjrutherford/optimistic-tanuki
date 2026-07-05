#!/bin/sh

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
SCRIPT_UNDER_TEST="$ROOT_DIR/scripts/wait-for-node-entrypoint.sh"

TMP_DIR=$(mktemp -d)
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

FAKE_NODE_DIR="$TMP_DIR/bin"
ENTRYPOINT="$TMP_DIR/dist/main.js"
OUTPUT_FILE="$TMP_DIR/node-output.txt"
FAKE_NODE="$FAKE_NODE_DIR/node"

mkdir -p "$FAKE_NODE_DIR" "$(dirname "$ENTRYPOINT")"

cat >"$FAKE_NODE" <<EOF
#!/bin/sh
printf '%s\n' "\$@" > "$OUTPUT_FILE"
EOF
chmod +x "$FAKE_NODE"

PATH="$FAKE_NODE_DIR:$PATH" sh "$SCRIPT_UNDER_TEST" "$ENTRYPOINT" --inspect=0.0.0.0:9000 &
SCRIPT_PID=$!

sleep 1

if ! kill -0 "$SCRIPT_PID" 2>/dev/null; then
  echo "wait script exited before entrypoint existed"
  exit 1
fi

if [ -f "$OUTPUT_FILE" ]; then
  echo "node was invoked before entrypoint existed"
  exit 1
fi

cat >"$ENTRYPOINT" <<'EOF'
console.log('hello from gateway');
EOF

wait "$SCRIPT_PID"

if [ ! -f "$OUTPUT_FILE" ]; then
  echo "node was never invoked"
  exit 1
fi

EXPECTED_ARGS="--inspect=0.0.0.0:9000
$ENTRYPOINT"
ACTUAL_ARGS=$(cat "$OUTPUT_FILE")

if [ "$ACTUAL_ARGS" != "$EXPECTED_ARGS" ]; then
  echo "unexpected node invocation"
  printf 'expected:\n%s\n' "$EXPECTED_ARGS"
  printf 'actual:\n%s\n' "$ACTUAL_ARGS"
  exit 1
fi

echo "wait-for-node-entrypoint test passed"
