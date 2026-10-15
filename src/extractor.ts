import fs from 'fs';
import path from 'path';
import os from 'os';
import { WebPageContent } from './page_content';
import { domDistillerScript } from './domdistiller';

const PAGE_GOTO_OPTIONS = { timeout: 90000 };
type DistilOptions = { extractTextOnly: boolean };

export class Distiller {
  private static distiller: Distiller;

  private constructor(
    private browser: any,
    private domDistillerScript: string,
    private extractTextOnly: boolean
  ) {}

  static async launchBrowser(): Promise<any> {
    const candidatePaths = [
      process.env.PUPPETEER_EXECUTABLE_PATH,
      process.env.CHROME_BIN,
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      path.join(
        os.homedir(),
        '.cache',
        'ms-playwright',
        'chromium-1243',
        'chrome-linux-arm64',
        'chrome'
      ),
    ].filter((p): p is string => Boolean(p && fs.existsSync(p)));

    const executablePath = candidatePaths[0];
    const localLibs = path.join(os.homedir(), '.local', 'lib', 'chrome-libs');
    const customEnv = fs.existsSync(localLibs)
      ? {
          ...process.env,
          LD_LIBRARY_PATH: `${localLibs}:${process.env.LD_LIBRARY_PATH || ''}`,
        }
      : process.env;

    const launchArgs = [
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ];

    if (executablePath) {
      const puppeteer = await import('puppeteer-core');
      return await puppeteer.launch({
        headless: true,
        executablePath,
        timeout: 60000,
        env: customEnv,
        args: launchArgs,
      });
    }

    const puppeteer = await import('puppeteer');
    return await puppeteer.launch({
      headless: true,
      env: customEnv,
      args: launchArgs,
    });
  }

  static fromBrowser(
    browser: any,
    extractTextOnly: boolean = false,
    script: string = domDistillerScript
  ): Distiller {
    return new Distiller(browser, script, extractTextOnly);
  }

  static async create(
    options: DistilOptions = { extractTextOnly: false }
  ): Promise<Distiller> {
    if (!Distiller.distiller) {
      const browser = await this.launchBrowser();
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
      await distiller.closeBrowser();
    }
  }

  async distilPage(url: string): Promise<WebPageContent> {
    const page = await this.browser.newPage();
    try {
      await page.goto(url, PAGE_GOTO_OPTIONS);
      await page.evaluate(this.domDistillerScript);

      // https://github.com/chromium/dom-distiller-dist/blob/main/proto/dom_distiller.proto
      // 1 = extract_text_only: true
      // 2 = debug_level: 0 -- log nothing. 3 -- everything.
      // 3 = original_url
      const result: any = await page.evaluate(
        (extractTextOnly: boolean, targetUrl: string) => {
          var options = { 1: extractTextOnly, 2: 0, 3: targetUrl };
          return (window as any).org.chromium.distiller.DomDistiller.applyWithOptions(options);
        },
        this.extractTextOnly,
        url
      );

      return WebPageContent.fromDistillationResult(result);
    } finally {
      await page.close();
    }
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
    Distiller.distiller = undefined as any;
  }
}
