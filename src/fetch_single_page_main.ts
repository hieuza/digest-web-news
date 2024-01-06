import yargs from 'yargs';
import * as fs from 'fs';
import { Distiller } from './extractor';
import { Digestor } from './digest';

const argv = yargs.options({
  url: { type: 'string', demandOption: true },
  output_dir: { type: 'string', demandOption: false },
  extract_text_only: { type: 'boolean', default: false },
  do_digest: { type: 'boolean', default: true },
}).argv as any;

Distiller.perform(
  { extractTextOnly: argv.extract_text_only },
  async (distiller: Distiller) => {
    const url = argv.url;

    console.log('URL:', url);
    const page = await distiller.distilPage(url);
    console.log(page.headline);
    console.log(page.content);

    if (argv.do_digest) {
      page.processed = await Digestor.processPage(page);
      console.log('-'.repeat(80));
      console.log(page.processed);
      // How to make it as a part of the page?
    }

    if (argv.output_dir) {
      if (!fs.existsSync(argv.output_dir)) {
        fs.mkdirSync(argv.output_dir, { recursive: true });
      }
      console.log(`Output articles to ${argv.output_dir}`);
      await page.write(argv.output_dir);
    }
  }
);
