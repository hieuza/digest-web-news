import yargs from 'yargs';
import * as fs from 'fs';
import * as path from 'path';
import moment from 'moment';
import { promisify } from 'util';
import { Distiller } from './extractor';
import { HackerNews } from './hackernews';
import { Digestor } from './digest';
import { PageFolder } from './page_content';

const writeFileAsync = promisify(fs.writeFile);

const argv = yargs.options({
  output_dir: {
    type: 'string',
    demandOption: true,
    default: '/tmp/hackernews',
    describe: 'Output folder containing a subfolder for each story.',
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

class UrlDatabase {
  constructor(public urls: Set<string>) {}

  static fromFile(urls_file: string): UrlDatabase {
    const urls = fs.existsSync(urls_file)
      ? fs
          .readFileSync(urls_file, 'utf-8')
          .split(/\r?\n/)
          .filter((line) => line.length > 0)
      : [];
    return new UrlDatabase(new Set(urls));
  }

  static readAndBackup(folder: string): UrlDatabase {
    const urls_file = path.join(folder, 'urls.txt');
    const url_db = UrlDatabase.fromFile(urls_file);
    url_db.backup(folder);
    return url_db;
  }

  // Writes the current database to a given file.
  writeToFile(output_file: string) {
    fs.writeFileSync(output_file, Array.from(this.urls).join('\n'), 'utf-8');
  }

  // Writes the current database to the file `urls.txt` in a given folder.
  writeDatabase(folder: string) {
    const output_file = path.join(folder, 'urls.txt');
    this.writeToFile(output_file);
  }

  // Backups the current database to a file in a given folder.
  backup(folder: string) {
    const timestamp = moment().format('YYYY-MM-DD-HHmmss');
    const backup_file = path.join(folder, `urls-${timestamp}.txt`);
    this.writeToFile(backup_file);
  }

  // Checks whether a given URL exists in the database.
  contains = (url: string) => this.urls.has(url);

  // Adds a URL to the database.
  add = (url: string) => this.urls.add(url);

  // Removes a URL from the database.
  remove = (url: string) => this.urls.delete(url);
}

// Unsed. Keep it here for end-to-end testing.
const sample_stories: any[] = [
  JSON.parse(`
    {
      "id": 38292915,
      "title": "I spent 3 years working on a coat hanger [video]",
      "type": "story",
      "url": "https://www.youtube.com/watch?v=vREokZa4dNU"
    }`),
  JSON.parse(`
    {
      "id": 38292409,
      "title": "Google resumes transition to Manifest V3 for Chrome extensions",
      "type": "story",
      "url": "https://developer.chrome.com/blog/resuming-the-transition-to-mv3/"
    }`),
];

const fetch_stories = async (
  distiller: Distiller,
  data_dir: string,
  do_digest: boolean,
  stories: any[],
  min_score: number,
  max_candidates: number,
  max_output: number
) => {
  if (!fs.existsSync(data_dir)) fs.mkdirSync(data_dir, { recursive: true });

  // Read and backup the current urls.
  const url_db = UrlDatabase.readAndBackup(data_dir);

  // Collect candidate new stories to evaluate
  const candidates: any[] = [];
  for (const story of stories) {
    if (min_score > 0 && story.score < min_score) continue;

    const storyId: number = story.id;
    const storyUrl: string = `https://news.ycombinator.com/item?id=${storyId}`;
    const url: string = story.url || storyUrl;

    if (url_db.contains(url)) continue;
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

    // Add the URL to the database immediately to mark it as processed
    url_db.add(url);

    const outputFolder = path.join(data_dir, storyId.toString());
    const outputStoryJsonFile = new PageFolder(outputFolder).story_file();

    let processedText: string | null = null;

    if (fs.existsSync(outputStoryJsonFile)) {
      const processedFile = new PageFolder(outputFolder).processed_file();
      if (fs.existsSync(processedFile)) {
        try {
          // Read double-encoded JSON string
          processedText = JSON.parse(fs.readFileSync(processedFile, 'utf-8'));
        } catch (e) {
          console.error(`Error reading processed file for story ${storyId}:`, e);
        }
      }
    } else {
      try {
        const distilledPage = await distiller.distilPage(url);
        if (do_digest) {
          processedText = await Digestor.processPage(distilledPage);
          distilledPage.processed = processedText;
        }
        fs.mkdirSync(outputFolder, { recursive: true });
        await distilledPage.write(outputFolder);
        await writeFileAsync(
          outputStoryJsonFile,
          JSON.stringify(story, null, 2),
          'utf8'
        );
      } catch (error) {
        console.error(`Error processing story ${storyId}:`, error);
      }
    }

    processedStories.push({
      story,
      url,
      storyUrl,
      subject,
      processed: processedText
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

    finalStories = [...aiStories, ...nonAiStories, ...failedOrSkippedStories].slice(0, max_output);
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

  url_db.writeDatabase(data_dir);
};

const distill_hackernews = async (distiller: Distiller) => {
  const data_dir = argv.output_dir;
  // Fetch the new stories.
  const stories = await getStory(argv.story_type);
  await fetch_stories(
    distiller,
    data_dir,
    argv.do_digest,
    stories,
    argv.min_score,
    argv.max_candidates,
    argv.max_output
  );
};

// Fetch the Hackernews stories.
Distiller.perform({ extractTextOnly: true }, distill_hackernews);
