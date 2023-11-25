Fetch and distill the content of web pages using DOM Distiller script.

Steps to run:

```bash
# Compile the TypeScript code. Run once.
tsc
# Run on a given URL.
URL=http://www.paulgraham.com/hwh.html
node fetch_single_page.js --url=${URL} --output_dir=/tmp/
```

TODO:

- Run Digestor on all distilled articles in a folder.

- Add database to save (current folder).

# Set-up SSMTP and cron job to digest article daily (Ubuntu)

Currently it fetches and sends the article headlines + URLs only. See a [sample](https://justpaste.it/bv6f7).

## Set-up Gmail account

- Create a app password (16 chars) in Google account: [apppasswords](https://myaccount.google.com/apppasswords), which may require the two-factor authentication.

## Install and config ssmtp

`/etc/ssmtp/ssmtp.conf`

```bash
mailhub=smtp.gmail.com:587
FromLineOverride=YES
AuthUser=<your_mail>@gmail.com
AuthPass=<google app password, 16 chars no space>
UseSTARTTLS=YES
UseTLS=YES
```

## Create a script to fetch articles and send email

`~/data/run_hackernews.sh`

```bash
#!/bin/bash -l

timestamp=`date "+%Y-%m-%d"`
filename="${timestamp}-hackernews.txt"
output_file="~/data/${filename}"

cd ~/code/puppeteer-page-content
~/.nvm/versions/node/v18.16.1/bin/node hackernews_main.js --output_dir=~/data/hackernews 2>&1 | tee ${output_file}

{
  echo "From: <your_email>@gmail.com"
  echo "To: <your_email>@gmail.com"
  echo "Subject: ${filename}"
  echo ""
  cat "${output_file}" | grep -P "^\d+ \|"
} > /tmp/email.txt

ssmtp -t < /tmp/email.txt
```

**NOTE**:

- Set the correct `node` path. Use `node` can result in `/usr/bin/node` which can be different from local/preferred `node`.
- `-l` in `#!/bin/bash -l` is important to load ~/.bash_profile, which should contain `OPENAI_API_KEY` ([Source](https://stackoverflow.com/a/51591762/956507))

## Cron job

`crontab -e`

```bash
# Disable cron job status email.
MAILTO=""
# Fetch and send email at 5AM everyday.
0 5 * * * ~/data/run_hackernews.sh
```

### Optional: enable cron log

- Uncomment `#cron.*` in `/etc/rsyslog.d/50-default.conf`
- Restart `rsyslog`: `sudo service rsyslog restart`
- The log: `/var/log/cron.log`
