// Finds and lists the already fetched URLs in a given folder.
import yargs from 'yargs';
import fs from 'fs';
import path from 'path';

export const readSubfolders = (input_dir: string) =>
  fs
    .readdirSync(input_dir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((direct) => path.join(input_dir, direct.name));

export const readUrl = (folder: string) => {
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

export const inventoryUrls = (input_dir: string, output_file: string) => {
  const subfolders: string[] = readSubfolders(input_dir);
  const urls: string[] = subfolders
    .map((folder) => readUrl(folder))
    .filter((url) => url !== null);

  fs.writeFileSync(output_file, urls.join('\n'), 'utf-8');
  return urls;
};

if (require.main === module) {
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

  inventoryUrls(argv.input_dir, argv.output_file);
}
