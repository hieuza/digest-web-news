# digest-web-news

Automated web news distillation, executive AI summarization, and SQLite storage engine.

- **Web Distillation**: Fetches and distills web articles using headless Chromium and the DOM Distiller script.
- **Executive AI Summarization**: Synthesizes core claims, arguments, and technical insights in a direct, declarative voice (no third-person meta-language) using Google Gemini (`gemini-3.8-flash`).
- **SQLite Storage**: Stores metadata, full article text, reconstructed HTML, and raw distillation JSON in an optimized SQLite database with FTS5 full-text search and tag clustering.
- **Email Digest**: Formats and delivers daily top stories via SSMTP.

A daily cron job running on a Raspberry Pi / server sends the digested daily news to [webnews-101@googlegroups.com](https://groups.google.com/g/webnews-101).

---

## 1. Setup & Installation

### Prerequisites
- Node.js (>= 18.x)
- Chromium / Chrome browser (installed automatically via Puppeteer or system package)
- Google Gemini API Key

```bash
# Clone the repository
git clone https://github.com/hieuza/digest-web-news.git
cd digest-web-news

# Install dependencies
npm install

# Compile TypeScript to dist/
npm run build
```

### Environment Variables

Set the following environment variables in your shell profile (`~/.bashrc`, `~/.bash_profile`, or systemd/cron environment):

| Variable | Description | Default |
| :--- | :--- | :--- |
| `GOOGLE_API_KEY` | Google Gemini API key for AI summarization | *(Required for AI digest)* |
| `GENAI_MODEL` | Gemini model name | `gemini-3.8-flash` |
| `SQLITE_DB_PATH` | Path to SQLite database file | `$HOME/data/hackernews.db` |
| `FROM_EMAIL` | Sender email address for daily digest | *(Optional)* |
| `TO_EMAIL` | Recipient email address for daily digest | *(Optional)* |

---

## 2. Usage

### A. Run Hacker News Ingestion

Fetch, distill, summarize, and save candidate stories directly into SQLite:

```bash
# Using default database (~/data/hackernews.db):
node dist/hackernews_main.js \
  --min_score=100 \
  --max_candidates=30 \
  --max_output=10 \
  --story_type=best

# Or specify a custom database path:
node dist/hackernews_main.js \
  --db_path="/path/to/custom.db" \
  --max_candidates=10
```

#### CLI Options
- `--db_path`: Path to SQLite database file (default: `$SQLITE_DB_PATH` or `~/data/hackernews.db`).
- `--story_type`: Hacker News feed type: `best` or `top` (default: `best`).
- `--min_score`: Minimum score required to evaluate a candidate story (default: `-1`).
- `--max_candidates`: Maximum number of new stories to fetch/process (default: `30`).
- `--max_output`: Maximum number of stories to print/output (default: `10`).
- `--do_digest`: Whether to generate AI summaries and topic tags (default: `true`).

### B. Distill a Single Web Page

Extract and distill clean article content from a web page (e.g. Paul Graham's essay *"How to Work Hard"*):

```bash
URL="https://paulgraham.com/hwh.html"
node dist/fetch_single_page_main.js --url="${URL}" --extract_text_only=true --output_dir=/tmp/
```

---

## 3. Database Architecture

The SQLite database (`~/data/hackernews.db`) is structured to separate lightweight metadata from heavy content while providing fast full-text search and tag clustering:

```
+------------------+             +----------------------+             +------------------------+
|       tags       |             |       stories        | <---------> |     story_contents     |
+------------------+             +----------------------+             +------------------------+
| id (PK)          |             | id (PK)              |             | story_id (PK, FK)      |
| name, slug       |             | title, url, score    |             | content (plain text)   |
| tag_type         |             | by, time, descendants|             | article_html (HTML)    |
| cluster_id (FK)  |             | headline, summary    |             | distillation_json      |
+------------------+             | about_ai             |             +------------------------+
        |                        | full_content         |                         |
        v                        | raw_tags, raw_proc   |                         |
+-------------------+            +----------------------+                         |
|    story_tags     |                       |                                     |
+-------------------+                       v                                     |
| story_id, tag_id  |            +----------------------+                         |
| source, confidence|            |      seen_urls       |                         |
+-------------------+            +----------------------+                         |
                                 | url (PK), story_id   |                         |
                                 | status               |                         |
                                 +----------------------+                         |
                                                                                  |
                                 +-------------------------+                      |
                                 |       stories_fts       | <--------------------+
                                 |  (FTS5 Virtual Table)   |
                                 +-------------------------+
```

### Useful SQLite Queries

```bash
# Open the database
sqlite3 ~/data/hackernews.db
```

#### Full-Text Search (FTS5)
```sql
-- Search for stories matching keywords or phrases
SELECT s.id, s.title, s.score,
       snippet(stories_fts, 2, '<b>', '</b>', '...', 15) AS summary_snippet
FROM stories_fts fts
JOIN stories s ON fts.id = s.id
WHERE stories_fts MATCH '"Manifest V3" OR sqlite'
ORDER BY rank
LIMIT 5;
```

#### Retrieve Stories by Tag
```sql
-- Retrieve all stories tagged with 'rust'
SELECT s.id, s.title, s.score, s.summary
FROM stories s
JOIN story_tags st ON s.id = st.story_id
JOIN tags t ON st.tag_id = t.id
WHERE t.slug = 'rust'
ORDER BY s.score DESC
LIMIT 10;
```

#### Deduplication Check
```sql
-- Check if a URL has already been seen or failed
SELECT url, status, created_at FROM seen_urls WHERE url = 'https://example.com/article';
```

---

## 4. Automation via SSMTP and Cron Job (Linux / Raspberry Pi)

### A. Install and Configure SSMTP
Edit `/etc/ssmtp/ssmtp.conf`:
```ini
mailhub=smtp.gmail.com:587
FromLineOverride=YES
AuthUser=your_email@gmail.com
AuthPass=your_16_char_google_app_password
UseSTARTTLS=YES
UseTLS=YES
```

### B. Shell Script Setup
Ensure permissions on `run_hackernews.sh`:
```bash
chmod +x run_hackernews.sh
```

The script runs the ingestion, prints output, records a timestamped log to `~/data/`, and emails the digest via `ssmtp`.

### C. Configure Crontab
```bash
crontab -e
```

Add the following entry to execute daily at 5:00 AM:
```cron
MAILTO=""
0 5 * * * /bin/bash -l $HOME/code/digest-web-news/run_hackernews.sh >> /var/log/run_hackernews.log 2>&1
```

*(Note: The `-l` flag in `/bin/bash -l` ensures `~/.bash_profile` is loaded with your `GOOGLE_API_KEY`, `FROM_EMAIL`, and `TO_EMAIL` environment variables).*

### D. Raspberry Pi Notes
If running on an ARM-based Raspberry Pi, ensure Chromium is installed:
```bash
sudo apt update && sudo apt install -y chromium-browser
```
The application detects the ARM architecture automatically and uses the system Chromium binary.
