#!/bin/bash -l

timestamp=`date "+%Y-%m-%d-%H%M%S"`
filename="${timestamp}-hackernews.txt"
output_file="$HOME/data/${filename}"

echo '---------------------------'
echo Output to ${output_file}

cd $HOME/code/digest-web-news
$HOME/.nvm/versions/node/v20.10.0/bin/node dist/hackernews_main.js --output_dir=$HOME/data/hackernews | tee ${output_file}

{
  echo "From: ${FROM_EMAIL}"
  echo "To: ${TO_EMAIL}"
  echo "Subject: ${filename}"
  echo ""
  cat "${output_file}"
} > /tmp/email.txt

ssmtp -t < /tmp/email.txt