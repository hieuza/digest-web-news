import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { WebPageContent } from './page_content';

export function getDatabasePath(): string {
  return (
    process.env.SQLITE_DB_PATH ||
    path.join(os.homedir(), 'data', 'hackernews.db')
  );
}

function slugify(text: string): string {
  if (!text) return 'unknown';
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[-\s]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'unknown';
}

function parseProcessedJson(rawText: string | null): {
  summary: string | null;
  tags: string[];
  about_ai: number | null;
  full_content: number | null;
} {
  if (!rawText || !rawText.trim()) {
    return { summary: null, tags: [], about_ai: null, full_content: null };
  }

  let text = rawText.trim();
  if (text.startsWith('```json')) text = text.slice(7);
  if (text.startsWith('```')) text = text.slice(3);
  if (text.endsWith('```')) text = text.slice(0, -3);
  text = text.trim();

  let data: any = null;
  try {
    data = JSON.parse(text);
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }
  } catch (e) {
    if (text.endsWith('}}')) {
      try {
        data = JSON.parse(text.slice(0, -1));
      } catch {}
    } else if (!text.endsWith('}')) {
      try {
        data = JSON.parse(text + '}');
      } catch {}
    }
  }

  if (data && typeof data === 'object') {
    const summary = typeof data.summary === 'string' ? data.summary : null;
    let tags: string[] = [];
    if (Array.isArray(data.tags)) {
      tags = data.tags.filter((t: any) => typeof t === 'string' && t.trim().length > 0);
    } else if (typeof data.tags === 'string') {
      tags = data.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0);
    }
    const about_ai = typeof data.about_ai === 'boolean' ? (data.about_ai ? 1 : 0) : null;
    const full_content = typeof data.full_content === 'boolean' ? (data.full_content ? 1 : 0) : null;
    return { summary, tags, about_ai, full_content };
  }

  return { summary: null, tags: [], about_ai: null, full_content: null };
}

export class SqliteDatabase {
  private db: Database.Database;

  private checkUrlStmt: Database.Statement;
  private checkStoryStmt: Database.Statement;
  private insertFailedUrlStmt: Database.Statement;
  private insertStoryStmt: Database.Statement;
  private insertContentStmt: Database.Statement;
  private insertSeenUrlStmt: Database.Statement;
  private insertTagStmt: Database.Statement;
  private getTagStmt: Database.Statement;
  private insertStoryTagStmt: Database.Statement;

  constructor(dbPath: string = getDatabasePath()) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.initSchema();

    this.checkUrlStmt = this.db.prepare(
      'SELECT 1 FROM seen_urls WHERE url = ? LIMIT 1'
    );
    this.checkStoryStmt = this.db.prepare(
      'SELECT 1 FROM stories WHERE id = ? LIMIT 1'
    );
    this.insertFailedUrlStmt = this.db.prepare(
      'INSERT OR REPLACE INTO seen_urls (url, story_id, status) VALUES (?, ?, ?)'
    );
    this.insertStoryStmt = this.db.prepare(`
      INSERT OR REPLACE INTO stories (
        id, title, url, score, by, time, type, descendants,
        kids, text, headline, summary, about_ai, full_content,
        raw_tags, raw_processed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.insertContentStmt = this.db.prepare(`
      INSERT OR REPLACE INTO story_contents (
        story_id, content, article_html, distillation_json
      ) VALUES (?, ?, ?, ?)
    `);
    this.insertSeenUrlStmt = this.db.prepare(
      'INSERT OR REPLACE INTO seen_urls (url, story_id, status) VALUES (?, ?, ?)'
    );
    this.insertTagStmt = this.db.prepare(
      'INSERT OR IGNORE INTO tags (name, slug, tag_type) VALUES (?, ?, ?)'
    );
    this.getTagStmt = this.db.prepare(
      'SELECT id FROM tags WHERE slug = ? LIMIT 1'
    );
    this.insertStoryTagStmt = this.db.prepare(
      'INSERT OR IGNORE INTO story_tags (story_id, tag_id, source, confidence) VALUES (?, ?, ?, ?)'
    );
  }

  private initSchema() {
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS stories (
        id INTEGER PRIMARY KEY,
        title TEXT,
        url TEXT,
        score INTEGER,
        by TEXT,
        time INTEGER,
        type TEXT DEFAULT 'story',
        descendants INTEGER,
        kids TEXT,
        text TEXT,
        headline TEXT,
        summary TEXT,
        about_ai INTEGER,
        full_content INTEGER,
        raw_tags TEXT,
        raw_processed TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_stories_url ON stories(url);
      CREATE INDEX IF NOT EXISTS idx_stories_time ON stories(time DESC);
      CREATE INDEX IF NOT EXISTS idx_stories_score ON stories(score DESC);
      CREATE INDEX IF NOT EXISTS idx_stories_about_ai ON stories(about_ai);

      CREATE TABLE IF NOT EXISTS story_contents (
        story_id INTEGER PRIMARY KEY REFERENCES stories(id) ON DELETE CASCADE,
        content TEXT,
        article_html TEXT,
        distillation_json TEXT
      );

      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        tag_type TEXT NOT NULL DEFAULT 'extracted',
        cluster_id INTEGER REFERENCES tags(id) ON DELETE SET NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_tags_cluster_id ON tags(cluster_id);
      CREATE INDEX IF NOT EXISTS idx_tags_type ON tags(tag_type);

      CREATE TABLE IF NOT EXISTS story_tags (
        story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        source TEXT NOT NULL DEFAULT 'extracted',
        confidence REAL DEFAULT 1.0,
        PRIMARY KEY (story_id, tag_id, source)
      );

      CREATE INDEX IF NOT EXISTS idx_story_tags_tag_story ON story_tags(tag_id, story_id);
      CREATE INDEX IF NOT EXISTS idx_story_tags_source ON story_tags(source);

      CREATE TABLE IF NOT EXISTS seen_urls (
        url TEXT PRIMARY KEY,
        story_id INTEGER,
        status TEXT NOT NULL DEFAULT 'success',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_seen_urls_story_id ON seen_urls(story_id);

      CREATE VIRTUAL TABLE IF NOT EXISTS stories_fts USING fts5(
        id UNINDEXED,
        title,
        headline,
        summary,
        content,
        tokenize='porter unicode61'
      );

      CREATE TRIGGER IF NOT EXISTS stories_ai AFTER INSERT ON stories BEGIN
        INSERT INTO stories_fts(id, title, headline, summary, content)
        VALUES (new.id, new.title, new.headline, new.summary,
                (SELECT content FROM story_contents WHERE story_id = new.id));
      END;

      CREATE TRIGGER IF NOT EXISTS story_contents_ai AFTER INSERT ON story_contents BEGIN
        UPDATE stories_fts
        SET content = new.content
        WHERE id = new.story_id;
      END;

      CREATE TRIGGER IF NOT EXISTS stories_ad AFTER DELETE ON stories BEGIN
        DELETE FROM stories_fts WHERE id = old.id;
      END;

      CREATE TRIGGER IF NOT EXISTS stories_au AFTER UPDATE ON stories BEGIN
        UPDATE stories_fts
        SET title = new.title,
            headline = new.headline,
            summary = new.summary
        WHERE id = new.id;
      END;
    `);
  }

  // Checks whether a URL or story ID has already been processed or seen.
  contains(url: string, storyId?: number): boolean {
    if (url && this.checkUrlStmt.get(url) !== undefined) {
      return true;
    }
    if (storyId && this.checkStoryStmt.get(storyId) !== undefined) {
      return true;
    }
    return false;
  }

  // Record a failed URL so it is not repeatedly retried on every run.
  markUrlFailed(url: string, storyId?: number) {
    if (!url) return;
    this.insertFailedUrlStmt.run(url, storyId || null, 'failed');
  }

  // Atomically save a distilled and digested story into SQLite.
  saveStory(
    story: any,
    distilled: WebPageContent,
    processedText: string | null
  ) {
    const storyId: number = story.id;
    const storyUrl: string =
      story.url || `https://news.ycombinator.com/item?id=${storyId}`;
    const parsed = parseProcessedJson(processedText);

    const kidsStr =
      story.kids && Array.isArray(story.kids)
        ? JSON.stringify(story.kids)
        : null;
    const rawTagsStr =
      parsed.tags.length > 0 ? JSON.stringify(parsed.tags) : null;

    const htmlContent = `<html>
      <head>
        <style>
        body { max-width: 700px; margin: 0 auto ; }
        </style>
      </head>
      <body>
        <h1>${distilled.headline || ''}</h1>
        ${distilled.content || ''}
      </body>
      </html>`;

    const distillationJsonStr =
      distilled.distilled !== undefined
        ? JSON.stringify(distilled.distilled, null, 2)
        : null;

    const transaction = this.db.transaction(() => {
      // 1. stories
      this.insertStoryStmt.run(
        storyId,
        story.title || null,
        storyUrl,
        story.score !== undefined ? story.score : null,
        story.by || null,
        story.time !== undefined ? story.time : null,
        story.type || 'story',
        story.descendants !== undefined ? story.descendants : null,
        kidsStr,
        story.text || null,
        distilled.headline || null,
        parsed.summary,
        parsed.about_ai,
        parsed.full_content,
        rawTagsStr,
        processedText
      );

      // 2. story_contents
      this.insertContentStmt.run(
        storyId,
        distilled.content || null,
        htmlContent,
        distillationJsonStr
      );

      // 3. seen_urls
      this.insertSeenUrlStmt.run(storyUrl, storyId, 'success');

      // 4. tags & story_tags
      for (const tag of parsed.tags) {
        const cleanName = tag.trim();
        if (!cleanName) continue;
        const slug = slugify(cleanName);
        this.insertTagStmt.run(cleanName, slug, 'extracted');
        const tagRow = this.getTagStmt.get(slug) as { id: number } | undefined;
        if (tagRow && tagRow.id) {
          this.insertStoryTagStmt.run(storyId, tagRow.id, 'extracted', 1.0);
        }
      }
    });

    transaction();
  }

  close() {
    this.db.close();
  }
}
