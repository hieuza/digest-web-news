import yargs from 'yargs';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { Distiller } from './extractor';
import { HackerNews } from './hackernews';

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

Distiller.perform({ extractTextOnly: true }, async (distiller: Distiller) => {
  const stories = await getStory(argv.story_type);

  for (const story of stories) {
    const url: string = story.url;
    const storyId: number = story.id;
    console.log(`${storyId} | ${story.title} | ${url}`);
    if (!url) {
      console.log(JSON.stringify(story));
      continue;
    }
    const outputFolder = path.join(argv.output_dir, storyId.toString());
    const outputStoryJsonFile = path.join(outputFolder, 'story.json');
    // Ignore if the content was distilled.
    if (fs.existsSync(outputStoryJsonFile)) continue;

    try {
      const distilledPage = await distiller.distilPage(url);
      fs.mkdirSync(outputFolder, { recursive: true });
      await distilledPage.write(outputFolder);
      writeFileAsync(
        outputStoryJsonFile,
        JSON.stringify(story, null, 2),
        'utf8'
      );
    } catch (error) {
      console.log('Error:', error);
    }
  }
});
