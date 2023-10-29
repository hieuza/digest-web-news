import yargs from 'yargs';
import * as fs from 'fs';
import { WebPageContent, Distiller } from './extractor';

const argv = yargs.options({
  url: { type: 'string', demandOption: true },
  output_dir: { type: 'string', demandOption: false },
  extract_text_only: { type: 'boolean', default: false },
}).argv as any;

Distiller.perform(
  { extractTextOnly: argv.extract_text_only },
  async (distiller: Distiller) => {
    const url = argv.url;

    console.log('URL:', url);
    const result = await distiller.distilPage(url);
    console.log(result.headline);
    console.log(result.content);

    if (argv.output_dir) {
      if (!fs.existsSync(argv.output_dir)) {
        fs.mkdirSync(argv.output_dir, { recursive: true });
      }
      console.log(`Output articles to ${argv.output_dir}`);
      await result.write(argv.output_dir);
    }
  }
);
