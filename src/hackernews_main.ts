import yargs from 'yargs';
import { Distiller } from './extractor';
import { HackerNews } from './hackernews';
import { Digestor } from './digest';
import { SqliteDatabase, getDatabasePath } from './db';

const argv = yargs.options({
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

const getStory = async (story_type: string) => {
  if (story_type === 'best') {
    return await HackerNews.fetchBestStories();
  } else if (story_type === 'top') {
    return await HackerNews.fetchTopStories();
  } else {
    throw TypeError(`Unknown story type: ${argv.story_type}`);
  }
};

const fetch_stories = async (
  distiller: Distiller,
  db: SqliteDatabase,
  do_digest: boolean,
  stories: any[],
  min_score: number,
  max_candidates: number,
  max_output: number
) => {
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
          const obj = JSON.parse(ps.processed);
          if (obj && obj.full_content === true) {
            if (obj.about_ai === true) {
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

  // Output/print the final selected list of stories
  for (const item of finalStories) {
    console.log('-'.repeat(80));
    console.log(item.storyUrl);
    console.log(item.subject);
    if (do_digest && item.processed) {
      Digestor.printProcessed(item.processed);
    }
  }
};

const distill_hackernews = async (distiller: Distiller) => {
  const dbPath = argv.db_path || getDatabasePath();
  const db = new SqliteDatabase(dbPath);
  try {
    // Fetch the new stories.
    const stories = await getStory(argv.story_type);
    await fetch_stories(
      distiller,
      db,
      argv.do_digest,
      stories,
      argv.min_score,
      argv.max_candidates,
      argv.max_output
    );
  } finally {
    db.close();
  }
};

// Fetch the Hackernews stories.
Distiller.perform({ extractTextOnly: true }, distill_hackernews);
