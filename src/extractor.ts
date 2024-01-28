import * as puppeteer from 'puppeteer-core';
import { WebPageContent } from './page_content';
import { domDistillerScript } from './domdistiller';

type DistilOptions = { extractTextOnly: boolean };

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
      const browser = await puppeteer.launch({ headless: 'new', executablePath: '/usr/bin/chromium-browser', product: 'chrome' });
      // Get DOM Distiller Script.
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
    try {
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

      return WebPageContent.fromDistillationResult(result);
    } finally {
      await page.close();
    }
  }

  async closeBrowser(): Promise<void> {
    await this.browser.close();
  }
}
