#!/bin/bash -l
set -e -o pipefail

timestamp=`date "+%Y-%m-%d-%H%M%S"`
filename="${timestamp}-hackernews.txt"
output_file="$HOME/data/${filename}"
tmp_file="/tmp/${timestamp}-email.txt"
db_path="${SQLITE_DB_PATH:-$HOME/data/hackernews.db}"

echo '---------------------------'
echo "Output log: ${output_file}"
echo "Database:   ${db_path}"

mkdir -p "$HOME/data"
mkdir -p "$(dirname "${db_path}")"

cd "$HOME/code/digest-web-news" || exit 1
node dist/hackernews_main.js \
  --min_score=100 \
  --max_candidates=30 \
  --max_output=10 \
  --story_type=best \
  --db_path="${db_path}" \
  | tee "${output_file}"

if [ ! -s "${output_file}" ]; then
  echo "ERROR: Output file '${output_file}' is empty or missing. Skipping email." >&2
  exit 1
fi

{
  echo "From: ${FROM_EMAIL}"
  echo "To: ${TO_EMAIL}"
  echo "Subject: ${filename}"
  echo ""
  cat "${output_file}"
} > "${tmp_file}"

ssmtp -t < "${tmp_file}"
rm -f "${tmp_file}"
