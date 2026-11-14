#!/usr/bin/env bash
set -e -o pipefail

DIR="$( cd "$( dirname "$(readlink -f "${BASH_SOURCE[0]}")" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

[ -f "$HOME/.bash_profile" ] && source "$HOME/.bash_profile"
[ -f "$HOME/.bashrc" ] && source "$HOME/.bashrc"

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

if ! command -v node >/dev/null 2>&1 && [ -d "$HOME/.nvm/versions/node" ]; then
  NVM_NODE_BIN="$(find "$HOME/.nvm/versions/node" -maxdepth 2 -type d -name bin | sort -V | tail -n 1)"
  [ -n "$NVM_NODE_BIN" ] && export PATH="$NVM_NODE_BIN:$PATH"
fi

# Advisory non-blocking flock locking (Exit 75 = EX_TEMPFAIL for systemd SuccessExitStatus)
LOCKFILE="${XDG_RUNTIME_DIR:-/tmp}/hackernews_digest.lock"
exec 9>"$LOCKFILE"
if ! flock -n 9; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] NOTICE: Another digest-web-news instance is running ($LOCKFILE held). Exiting cleanly." >&2
  exit 75
fi

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=1
  shift
fi

timestamp="$(date "+%Y-%m-%d-%H%M%S")"
filename="${timestamp}-hackernews.txt"
html_filename="${timestamp}-hackernews.html"
output_file="$HOME/data/${filename}"
output_html="$HOME/data/${html_filename}"
tmp_file="/tmp/${timestamp}-email.txt"
db_path="${SQLITE_DB_PATH:-$HOME/data/hackernews.db}"
to_email="${1:-${TO_EMAIL:-webnews-101@googlegroups.com}}"
from_email="${FROM_EMAIL:-Hacker News Digest <tdh.net@gmail.com>}"
email_date="$(date "+%a, %b %-d, %Y")"
subject="Hacker News Digest — ${email_date}"

trap 'rm -f "${tmp_file}"' EXIT

echo '---------------------------'
echo "Working dir: ${DIR}"
echo "Node binary: $(command -v node || echo 'MISSING')"
echo "Output log:  ${output_file}"
echo "Output html: ${output_html}"
echo "Database:    ${db_path}"
echo "Recipient:   ${to_email}"
echo "Lockfile:    ${LOCKFILE}"

mkdir -p "$HOME/data"
mkdir -p "$(dirname "${db_path}")"

SSMTP_BIN="/usr/sbin/ssmtp"
if ! command -v "$SSMTP_BIN" >/dev/null 2>&1; then
  SSMTP_BIN="ssmtp"
fi

if [ "$DRY_RUN" -eq 1 ]; then
  node dist/hackernews_main.js --help >/dev/null
  echo "[Dry Run] Environment, node ($(node -v)), dist/hackernews_main.js, and lock verified successfully."
  exit 0
fi

node dist/hackernews_main.js \
  --min_score=100 \
  --max_candidates=30 \
  --max_output=10 \
  --story_type=best \
  --db_path="${db_path}" \
  --html_output_path="${output_html}" \
  | tee "${output_file}"

if [ ! -s "${output_html}" ]; then
  echo "ERROR: HTML output file '${output_html}' is empty or missing. Skipping email." >&2
  exit 1
fi

{
  echo "From: ${from_email}"
  echo "To: ${to_email}"
  echo "Subject: ${subject}"
  echo "MIME-Version: 1.0"
  echo "Content-Type: text/html; charset=UTF-8"
  echo ""
  cat "${output_html}"
} > "${tmp_file}"

if "$SSMTP_BIN" -t < "${tmp_file}" 2>/dev/null; then
  echo "Digest email successfully sent to ${to_email}."
elif ssh -o StrictHostKeyChecking=no -o BatchMode=yes localhost "/usr/sbin/ssmtp -t" < "${tmp_file}" 2>/dev/null; then
  echo "Digest email successfully sent to ${to_email}."
else
  echo "ERROR: Failed to deliver email via ssmtp." >&2
  exit 1
fi
