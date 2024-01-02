- Fetch and distill the content of web pages using DOM Distiller script.
- Summarize the content via LLM API (e.g. OpenAI API).
- Send emails.


# General set-up

```bash
# (Optional) Install nvm and npm.
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash
nvm install --lts

# Install the required packages.
npm install
npm install -g ts-node typescript '@types/node'

# Compile the TypeScript code.
tsc

# Run on a given URL.
URL=http://www.paulgraham.com/hwh.html
node dist/fetch_single_page_main.js --url=${URL} --extract_text_only=true --output_dir=/tmp/
```

TODO:

- Run Digestor on all distilled articles in a folder.

- Add database to save (current folder).

# Set-up SSMTP and cron job to digest article daily (Ubuntu)

See a [sample email content](https://justpaste.it/c9xer).

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

`$HOME/data/run_hackernews.sh`

```bash
#!/bin/bash -l

timestamp=`date "+%Y-%m-%d"`
filename="${timestamp}-hackernews.txt"
output_file="$HOME/data/${filename}"

cd $HOME/code/puppeteer-page-content
$HOME/.nvm/versions/node/v18.16.1/bin/node dist/hackernews_main.js --output_dir=$HOME/data/hackernews | tee ${output_file}

{
  echo "From: ${FROM_EMAIL}"
  echo "To: ${TO_EMAIL}"
  echo "Subject: ${filename}"
  echo ""
  cat "${output_file}"
} > /tmp/email.txt

ssmtp -t < /tmp/email.txt
```

**NOTE**:

- Set the correct `node` path. Use `node` can result in `/usr/bin/node` which can be different from local/preferred `node`.
- `-l` in `#!/bin/bash -l` is important to load ~/.bash_profile, which should contain `OPENAI_API_KEY`, `TO_EMAIL`, `FROM_EMAIL` ([Source](https://stackoverflow.com/a/51591762/956507))

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

## Raspberry Pi

```
# install chromium-browser
sudo get install chromium-browser
```

Make a little change to the extractor.ts

```
-import * as puppeteer from 'puppeteer';
+import * as puppeteer from 'puppeteer-core';

...

-      const browser = await puppeteer.launch({ headless: 'new' });
+      const browser = await puppeteer.launch({ headless: 'new', executablePath: '/usr/bin/chromium-browser', product: 'chrome' });
```
