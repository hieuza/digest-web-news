import yargs from 'yargs';
import * as fs from 'fs';
import { WebPageContent, Distiller } from './extractor';

const argv = yargs.options({
  url: { type: 'string', demandOption: true },
  output_dir: { type: 'string', demandOption: false },
}).argv as any;

(async () => {
  const distiller = await Distiller.create();
  const url = argv.url;

  console.log('URL:', url);
  const result = await distiller.fetchPage(url);
  console.log(result.headline);
  console.log(result.content);

  if (argv.output_dir) {
    if (!fs.existsSync(argv.output_dir)) {
      fs.mkdirSync(argv.output_dir, { recursive: true });
    }
    console.log(`Output articles to ${argv.output_dir}`);
    await result.write(argv.output_dir);
  }

  // TODO: How to avoid manually close it using 'using' clause?
  await distiller.closeBrowser();
})();
