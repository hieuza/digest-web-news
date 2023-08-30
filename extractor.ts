import * as puppeteer from 'puppeteer-core';
import { readFile, writeFile } from 'fs';
import { promisify } from 'util';

const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);

const CHROME_BINARY = '/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_BINARY, headless: true });
  const page = await browser.newPage();

  // const URL = 'https://www.bbc.com/news/technology-66618852';
  // const URL = 'https://www.bbc.co.uk/news/technology-64285227';
  const URL = 'https://www.bbc.co.uk/news/technology-62788725';
  await page.goto(URL);

  // Get DOM Distiller Script.
  const scriptPath = '../domdistiller.js';
  const domDistillerScript = await readFileAsync(scriptPath, { encoding: 'utf8' });

  await page.evaluate(domDistillerScript);

  // 1 = extract_text_only: true
  // 2 = debug_level: 0 -- log nothing. 3 -- everything.
  // 3 = original_url
  const result: any = await page.evaluate(`
      var options = { 1: false, 2:3, 3: "${URL}" };
      org.chromium.distiller.DomDistiller.applyWithOptions(options);
  `);

  const headline = result['1'];
  const content = result['2']['1'];

  console.log(result);
  console.log(content);

  const content_file = '/tmp/article.txt';
  await writeFileAsync(content_file, `${headline}\n${content}`, 'utf8');

  const result_file = '/tmp/article.json';
  await writeFileAsync(result_file, JSON.stringify(result, null, 2), 'utf8');

  const content_html = `<html><body><h1>${headline}</h1>${content}</body></html>`;
  const html_file = '/tmp/article.html';
  await writeFileAsync(html_file, content_html, 'utf8');

  browser.close();
})();
