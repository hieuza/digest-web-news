import yargs from 'yargs';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { WebPageContent, Distiller } from './extractor';
import { HackerNews } from './hackernews';
import { TimeoutError } from 'puppeteer';

const writeFileAsync = promisify(fs.writeFile);

const argv = yargs.options({
  output_dir: {
    type: 'string',
    demandOption: true,
    default: '/tmp/hackernews',
  },
}).argv as any;

const createFolder = (folder: string) => {
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
};

(async () => {
  const distiller = await Distiller.create();
  const stories = await HackerNews.fetchBestStories();

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
      const distilledPage = await distiller.fetchPage(url);
      createFolder(outputFolder);
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

  // TODO: How to auto close it? Forget to close and it will hang.
  await distiller.closeBrowser();
})();
