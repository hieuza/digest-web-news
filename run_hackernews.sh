#!/bin/bash -l

timestamp=`date "+%Y-%m-%d-%H%M%S"`
filename="${timestamp}-hackernews.txt"
output_file="$HOME/data/${filename}"
tmp_file="/tmp/${timestamp}-email.txt"

echo '---------------------------'
echo Output to ${output_file}

cd $HOME/code/digest-web-news
node dist/hackernews_main.js \
  --min_score=100 \
  --max_candidates=30 \
  --max_output=10 \
  --story_type=best \
  --output_dir=$HOME/data/hackernews \
  | tee ${output_file}

{
  echo "From: ${FROM_EMAIL}"
  echo "To: ${TO_EMAIL}"
  echo "Subject: ${filename}"
  echo ""
  cat "${output_file}"
} > ${tmp_file}

ssmtp -t < ${tmp_file}

