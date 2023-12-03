// Finds and lists the already fetched URLs in a given folder.
import yargs from 'yargs';
import fs from 'fs';
import path from 'path';

const argv = yargs.options({
  input_dir: {
    type: 'string',
    demandOption: true,
    describe: 'Input folder containing a subfolder for each story.',
  },
  output_file: {
    type: 'string',
    demandOption: true,
    describe: 'Output file containing URLs per line.',
  },
}).argv as any;

const readSubfolders = (input_dir: string) =>
  fs
    .readdirSync(argv.input_dir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((direct) => path.join(input_dir, direct.name));

const readUrl = (folder: string) => {
  const story_file = path.join(folder, 'story.json');
  if (!fs.existsSync(story_file)) {
    return null;
  }

  try {
    const story = JSON.parse(fs.readFileSync(story_file, 'utf-8'));
    return story.url ?? null;
  } catch (error) {
    console.error('Error read & parse file in folder', folder, error);
    return null;
  }
};

(() => {
  const subfolders: string[] = readSubfolders(argv.input_dir);
  const urls: string[] = subfolders
    .map((folder) => readUrl(folder))
    .filter((url) => url !== null);

  fs.writeFileSync(argv.output_file, urls.join('\n'), 'utf-8');
})();
