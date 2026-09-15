#!/usr/bin/env bash
# usage: capture.sh <mode> <port> <story ids...>
MODE=$1; PORT=$2; shift 2; STORIES=("$@")
ROOT="${DESIGN_REVIEW_OUT:-/tmp/persona-eval}"; SB="${STORYBOOK_URL:-http://127.0.0.1:4310}/iframe.html"; OUT="$ROOT/$MODE"; mkdir -p "$OUT"
PERS="classic minimal bold soft professional playful elegant architect soft-touch electric control-center foundation"
PROFILE=/tmp/ab-chrome-persona-$MODE
google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars --remote-debugging-address=127.0.0.1 --remote-debugging-port=$PORT --user-data-dir=$PROFILE --window-size=960,620 about:blank >/dev/null 2>&1 &
CP=$!; for i in $(seq 1 30); do curl -s --max-time 1 http://127.0.0.1:$PORT/json/version >/dev/null && break; sleep 1; done
AB="timeout 45 agent-browser --session persona-$MODE"; $AB connect $PORT >/dev/null 2>&1
SIG='(()=>{const pick=(sel,props)=>{const el=[...document.querySelectorAll(sel)].find(e=>e.offsetWidth>0);if(!el)return null;const s=getComputedStyle(el);return Object.fromEntries(props.map(p=>[p,s[p]]))};return JSON.stringify({
button:pick("otui-button button",["borderRadius","borderTopWidth","borderTopStyle","boxShadow","fontFamily","fontWeight","textTransform","letterSpacing","paddingLeft","height","backgroundImage","backgroundColor"]),
input:pick("input.form-control",["borderRadius","borderTopWidth","borderTopStyle","boxShadow","fontFamily","height","backgroundColor","paddingLeft"]),
label:pick(".form-label",["fontFamily","fontWeight","textTransform","letterSpacing","fontSize"]),
card:pick(".card, .theme-verification, form, otui-card .card",["borderRadius","borderTopWidth","borderTopStyle","boxShadow","paddingLeft","backgroundColor"])})})()'
for p in $PERS; do
  for id in "${STORIES[@]}"; do
    $AB open "$SB?id=$id&viewMode=story&globals=personalityId:$p;colorMode:$MODE" >/dev/null 2>&1 || continue
    $AB wait --load networkidle >/dev/null 2>&1; $AB wait 1200 >/dev/null 2>&1
    $AB screenshot "$OUT/$id--$p.png" >/dev/null 2>&1
    case "$id" in *theme-verification*) echo "{\"mode\":\"$MODE\",\"personality\":\"$p\",\"story\":\"$id\",\"sig\":$($AB eval "$SIG" 2>/dev/null | tail -1)}" >> "$ROOT/signatures-$MODE.jsonl";; esac
  done
  echo "$MODE $p done $(date +%H:%M:%S)" >> "$ROOT/progress.log"
done
$AB close >/dev/null 2>&1; kill $CP 2>/dev/null; sleep 1; rm -rf $PROFILE
echo "$MODE finished" >> "$ROOT/progress.log"
