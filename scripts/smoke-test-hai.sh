#!/usr/bin/env bash
# Smoke test for the Hopeful Aspirations Industries site (apps/hai).
#
# Usage: scripts/smoke-test-hai.sh <base-url>
#   scripts/smoke-test-hai.sh https://hopefulaspirationsindustries.com
#   scripts/smoke-test-hai.sh http://localhost:4000
#
# Needs only bash and curl, and assumes nothing about how the site is hosted.
# It reads pages only: it never submits a form or creates data. Prints one
# PASS/FAIL line per check and exits non-zero if any check fails.

set -uo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <base-url>" >&2
  exit 2
fi

BASE_URL="${1%/}"
# Canonical URLs always name the production site, whichever host serves them.
CANONICAL_ORIGIN="https://hopefulaspirationsindustries.com"
PHONE="912-521-7314"
PHONE_LINK="tel:+19125217314"
EMAIL="chris@hopefulaspirationsindustries.com"

failures=0
checks=0

pass() {
  checks=$((checks + 1))
  printf 'PASS  %s\n' "$1"
}

fail() {
  checks=$((checks + 1))
  failures=$((failures + 1))
  printf 'FAIL  %s\n' "$1"
}

# Fetches a URL into $body and $status. Server-rendered HTML is what search
# engines and link previews see, so no JavaScript is involved.
fetch() {
  local url="$1"
  local response
  if ! response=$(curl --silent --show-error --location --max-time 30 \
    --write-out $'\n%{http_code}' "$url" 2>&1); then
    status="000"
    body="$response"
    return
  fi
  status="${response##*$'\n'}"
  body="${response%$'\n'*}"
}

contains() {
  [[ "$body" == *"$1"* ]]
}

# Route path (no leading slash), then the page title as it appears in the
# HTML, where "&" is written "&amp;".
routes=(
  "|Hopeful Aspirations Industries | Technology You Own"
  "private-cloud|Private Cloud Systems | Hopeful Aspirations Industries"
  "private-cloud/home|Private Cloud for Home, Photos &amp; Media | HAI"
  "private-cloud/organizations|Private Cloud for Small Businesses, Nonprofits &amp; Faith Groups | HAI"
  "private-cloud/open-source-stack|Open-Source Private Cloud Stack | HAI"
  "private-cloud/assessment|Private Cloud Assessment | HAI"
  "turn-key-appliances|Turn-key Server Appliances | HAI"
  "software-stacks|Industry Software Stacks | HAI"
  "cost-comparison|Subscriptions or Ownership? Cost Comparison | HAI"
  "custom-software|Custom Software &amp; Workflow Automation | HAI"
  "partners|White-Label Delivery for Local IT Partners | HAI"
  "how-we-work|How We Work | HAI"
  "contact|Contact | Hopeful Aspirations Industries"
)

check_page() {
  local path="$1" title="$2" query="${3:-}"
  local url="$BASE_URL/$path$query"
  local canonical="$CANONICAL_ORIGIN/$path"
  [ -z "$path" ] && canonical="$CANONICAL_ORIGIN/"
  local label="/$path$query"

  fetch "$url"
  if [ "$status" != "200" ]; then
    fail "$label returns 200 (got $status)"
    return
  fi
  pass "$label returns 200"

  if contains "<title>$title</title>"; then
    pass "$label has title \"$title\""
  else
    fail "$label has title \"$title\""
  fi

  if contains "<link rel=\"canonical\" href=\"$canonical\">"; then
    pass "$label has canonical $canonical"
  else
    fail "$label has canonical $canonical"
  fi
}

echo "Smoke testing $BASE_URL"
echo

for entry in "${routes[@]}"; do
  check_page "${entry%%|*}" "${entry#*|}"
done

echo
echo "Print campaign URLs (query strings exactly as printed):"
campaigns=(
  "private-cloud|?utm_source=print&utm_medium=flyer&utm_campaign=private_cloud|Private Cloud Systems | Hopeful Aspirations Industries"
  "private-cloud|?utm_source=print&utm_medium=brochure&utm_campaign=private_cloud|Private Cloud Systems | Hopeful Aspirations Industries"
  "private-cloud/open-source-stack|?utm_source=print&utm_medium=brochure&utm_campaign=oss_stack|Open-Source Private Cloud Stack | HAI"
)
for entry in "${campaigns[@]}"; do
  # The last field keeps the rest of the line, so the "|" in titles survives.
  IFS='|' read -r path query title <<< "$entry"
  check_page "$path" "$title" "$query"
done

echo
echo "Contact details:"
fetch "$BASE_URL/contact"
for detail in "$PHONE" "$PHONE_LINK" "$EMAIL" "mailto:$EMAIL"; do
  if [ "$status" = "200" ] && contains "$detail"; then
    pass "/contact shows $detail"
  else
    fail "/contact shows $detail"
  fi
done

echo
echo "Crawler files:"
fetch "$BASE_URL/sitemap.xml"
if [ "$status" = "200" ] && contains "<loc>$CANONICAL_ORIGIN/private-cloud</loc>"; then
  pass "/sitemap.xml lists the private-cloud page"
else
  fail "/sitemap.xml lists the private-cloud page (status $status)"
fi
fetch "$BASE_URL/robots.txt"
if [ "$status" = "200" ] && contains "Sitemap: $CANONICAL_ORIGIN/sitemap.xml"; then
  pass "/robots.txt points at the sitemap"
else
  fail "/robots.txt points at the sitemap (status $status)"
fi

echo
if [ "$failures" -gt 0 ]; then
  echo "$failures of $checks checks failed."
  exit 1
fi
echo "All $checks checks passed."
