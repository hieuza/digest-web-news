#!/bin/bash -l
set -e -o pipefail

timestamp=`date "+%Y-%m-%d-%H%M%S"`
filename="${timestamp}-hackernews.txt"
html_filename="${timestamp}-hackernews.html"
output_file="$HOME/data/${filename}"
output_html="$HOME/data/${html_filename}"
tmp_file="/tmp/${timestamp}-email.txt"
db_path="${SQLITE_DB_PATH:-$HOME/data/hackernews.db}"
to_email="${1:-${TO_EMAIL:-webnews-101@googlegroups.com}}"
from_email="${FROM_EMAIL:-Hacker News Digest <tdh.net@gmail.com>}"
email_date=`date "+%a, %b %-d, %Y"`
subject="Hacker News Digest — ${email_date}"

echo '---------------------------'
echo "Output log:  ${output_file}"
echo "Output html: ${output_html}"
echo "Database:    ${db_path}"
echo "Recipient:   ${to_email}"

mkdir -p "$HOME/data"
mkdir -p "$(dirname "${db_path}")"

cd "$HOME/code/digest-web-news" || exit 1
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

if id -Gn | grep -qw mail; then
  /usr/sbin/ssmtp -t < "${tmp_file}"
else
  ssh -o StrictHostKeyChecking=no localhost "/usr/sbin/ssmtp -t" < "${tmp_file}"
fi
rm -f "${tmp_file}"
echo "Digest email successfully sent to ${to_email}."
