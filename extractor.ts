import * as puppeteer from 'puppeteer';
import { readFile, writeFile } from 'fs';
import path from 'path';
import { promisify } from 'util';

const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);

const DD_SCRIPT_PATH = './domdistiller.js';

type DistilOptions = { extractTextOnly: boolean };

export class WebPageContent {
  constructor(
    public headline: string,
    public content: string,
    public result: any
  ) {}

  // TODO: move to an io util as a functional style.
  public async write(folder: string) {
    const content_file = path.join(folder, 'article.txt');
    await writeFileAsync(
      content_file,
      `${this.headline}\n${this.content}`,
      'utf8'
    );
    const result_file = path.join(folder, 'article.json');
    await writeFileAsync(
      result_file,
      JSON.stringify(this.result, null, 2),
      'utf8'
    );
    const content_html = `<html>
      <head>
        <style>
        body { max-width: 700px; margin: 0 auto ; }
        </style>
      </head>
      <body>
        <h1>${this.headline}</h1>
        ${this.content}
      </body>
      </html>`;
    const html_file = path.join(folder, 'article.html');
    await writeFileAsync(html_file, content_html, 'utf8');
  }
}

export class Distiller {
  private static distiller: Distiller;

  private constructor(
    private browser: puppeteer.Browser,
    private domDistillerScript: string,
    private extractTextOnly: boolean
  ) {}

  static async create(
    options: DistilOptions = { extractTextOnly: false }
  ): Promise<Distiller> {
    if (!Distiller.distiller) {
      const browser = await puppeteer.launch({ headless: 'new' });
      // Get DOM Distiller Script.
      const domDistillerScript = await readFileAsync(DD_SCRIPT_PATH, {
        encoding: 'utf8',
      });
      Distiller.distiller = new Distiller(
        browser,
        domDistillerScript,
        options.extractTextOnly
      );
    }

    return Distiller.distiller;
  }

  static async perform(
    options: DistilOptions,
    task: (distiller: Distiller) => Promise<void>
  ): Promise<void> {
    const distiller = await this.create(options);
    try {
      await task(distiller);
    } finally {
      distiller.closeBrowser();
    }
  }

  async distilPage(url: string): Promise<WebPageContent> {
    const page = await this.browser.newPage();
    await page.goto(url);
    await page.evaluate(this.domDistillerScript);

    // https://github.com/chromium/dom-distiller-dist/blob/main/proto/dom_distiller.proto
    // 1 = extract_text_only: true
    // 2 = debug_level: 0 -- log nothing. 3 -- everything.
    // 3 = original_url
    const result: any = await page.evaluate(`
        var options = { 1: ${this.extractTextOnly}, 2:0, 3: "${url}" };
        org.chromium.distiller.DomDistiller.applyWithOptions(options);
    `);
    await page.close();

    const headline = result['1'];
    const content = result['2']['1'];

    return new WebPageContent(headline, content, result);
  }

  async closeBrowser(): Promise<void> {
    await this.browser.close();
  }
}
