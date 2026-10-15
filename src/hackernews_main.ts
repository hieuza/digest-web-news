import fs from 'fs';
import path from 'path';
import yargs from 'yargs';
import { Distiller } from './extractor';
import { HackerNews } from './hackernews';
import { Digestor } from './digest';
import { SqliteDatabase, getDatabasePath, parseProcessedJson } from './db';
import { renderHtmlDigest, DigestItem } from './formatter';

export const parseArgs = () =>
  yargs.options({
    db_path: {
      type: 'string',
      default: getDatabasePath(),
      describe: 'Path to SQLite database file.',
    },
    output_dir: {
      type: 'string',
      default: '',
      describe: 'Deprecated: legacy output folder (now uses SQLite).',
    },
    html_output_path: {
      type: 'string',
      default: '',
      describe: 'Path to write formatted HTML digest file.',
    },
    story_type: {
      type: 'string',
      choices: ['top', 'best'],
      default: 'best',
      describe: 'which stories? Best or top?',
    },
    min_score: {
      type: 'number',
      default: -1,
      describe: 'minimum score',
    },
    max_stories: {
      type: 'number',
      default: -1,
      describe: 'max number of output stories (deprecated, use max_output instead)',
    },
    max_candidates: {
      type: 'number',
      default: 30,
      describe: 'max number of new stories to fetch/process',
    },
    max_output: {
      type: 'number',
      default: 10,
      describe: 'max number of stories to output/print',
    },
    do_digest: {
      type: 'boolean',
      default: true,
      describe: 'Whether to process the article content such as summarize.',
    },
  }).argv as any;

export const getStory = async (story_type: string) => {
  if (story_type === 'best') {
    return await HackerNews.fetchBestStories();
  } else if (story_type === 'top') {
    return await HackerNews.fetchTopStories();
  } else {
    throw TypeError(`Unknown story type: ${story_type}`);
  }
};

export const fetch_stories = async (
  distiller: Distiller,
  db: SqliteDatabase,
  do_digest: boolean,
  stories: any[],
  min_score: number,
  max_candidates: number,
  max_output: number,
  html_output_path?: string
): Promise<DigestItem[]> => {
  // Collect candidate new stories to evaluate
  const candidates: any[] = [];
  for (const story of stories) {
    if (min_score > 0 && story.score < min_score) continue;

    const storyId: number = story.id;
    const storyUrl: string = `https://news.ycombinator.com/item?id=${storyId}`;
    const url: string = story.url || storyUrl;

    // Check if already in SQLite seen_urls or stories
    if (db.contains(url, storyId)) continue;
    if (!url) continue;

    candidates.push(story);
    if (max_candidates > 0 && candidates.length >= max_candidates) {
      break;
    }
  }

  const processedStories: {
    story: any;
    url: string;
    storyUrl: string;
    subject: string;
    processed: string | null;
  }[] = [];

  for (const story of candidates) {
    const storyId: number = story.id;
    const storyUrl: string = `https://news.ycombinator.com/item?id=${storyId}`;
    const url: string = story.url || storyUrl;

    let subject: string = story.title;
    if (story.url) subject += ` | ${story.url}`;

    let processedText: string | null = null;

    try {
      const distilledPage = await distiller.distilPage(url);
      if (do_digest) {
        processedText = await Digestor.processPage(distilledPage);
        distilledPage.processed = processedText;
      }
      db.saveStory(story, distilledPage, processedText);
    } catch (error) {
      console.error(`Error processing story ${storyId} (${url}):`, error);
      db.markUrlFailed(url, storyId);
    }

    processedStories.push({
      story,
      url,
      storyUrl,
      subject,
      processed: processedText,
    });
  }

  // Filter and sort the processed stories
  let finalStories: typeof processedStories = [];
  if (do_digest) {
    const aiStories: typeof processedStories = [];
    const nonAiStories: typeof processedStories = [];
    const failedOrSkippedStories: typeof processedStories = [];

    for (const ps of processedStories) {
      if (ps.processed) {
        try {
          const obj = parseProcessedJson(ps.processed);
          if (obj && obj.full_content === 1) {
            if (obj.about_ai === 1) {
              aiStories.push(ps);
            } else {
              nonAiStories.push(ps);
            }
            continue;
          }
        } catch (e) {
          // Fall through to failedOrSkippedStories
        }
      }
      failedOrSkippedStories.push(ps);
    }

    finalStories = [
      ...aiStories,
      ...nonAiStories,
      ...failedOrSkippedStories,
    ].slice(0, max_output);
  } else {
    finalStories = processedStories.slice(0, max_output);
  }

  // Convert final stories to DigestItem format
  const digestItems: DigestItem[] = finalStories.map((item) => {
    let summary: string | null = null;
    let tags: string[] = [];
    let aboutAi: boolean = false;

    if (item.processed) {
      try {
        const parsed = parseProcessedJson(item.processed);
        summary = parsed.summary;
        tags = parsed.tags || [];
        aboutAi = parsed.about_ai === 1;
      } catch (e) {}
    }

    return {
      id: item.story?.id || 0,
      title: item.story?.title || item.subject,
      url: item.url,
      storyUrl: item.storyUrl,
      score: item.story?.score || 0,
      by: item.story?.by,
      descendants: item.story?.descendants,
      summary,
      tags,
      about_ai: aboutAi,
    };
  });

  // Output/print the final selected list of stories
  for (const item of finalStories) {
    console.log('-'.repeat(80));
    console.log(item.storyUrl);
    console.log(item.subject);
    if (do_digest && item.processed) {
      Digestor.printProcessed(item.processed);
    }
  }

  if (html_output_path) {
    const htmlContent = renderHtmlDigest(digestItems);
    fs.mkdirSync(path.dirname(path.resolve(html_output_path)), {
      recursive: true,
    });
    fs.writeFileSync(html_output_path, htmlContent, 'utf-8');
    console.log(`HTML digest saved: ${html_output_path}`);
  }

  return digestItems;
};

export const distill_hackernews = async (
  distiller: Distiller,
  cliArgs?: any
) => {
  const args = cliArgs || parseArgs();
  const dbPath = args.db_path || getDatabasePath();
  const db = new SqliteDatabase(dbPath);
  try {
    // Fetch the new stories.
    const stories = await getStory(args.story_type);
    return await fetch_stories(
      distiller,
      db,
      args.do_digest,
      stories,
      args.min_score,
      args.max_candidates,
      args.max_output,
      args.html_output_path
    );
  } finally {
    db.close();
  }
};

// Fetch the Hackernews stories when run directly.
if (require.main === module) {
  const cliArgs = parseArgs();
  Distiller.perform({ extractTextOnly: true }, async (distiller) => {
    await distill_hackernews(distiller, cliArgs);
  });
}
