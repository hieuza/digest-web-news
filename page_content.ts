import { readFile, writeFile, existsSync } from 'fs';
import path from 'path';
import { promisify } from 'util';

const writeFileAsync = promisify(writeFile);
const readFileAsync = promisify(readFile);

// Clean this part.
export const get_content_json = (folder: string) =>
  path.join(folder, 'article.json');
export const get_domdistiller_json = (folder: string) =>
  path.join(folder, 'distillation.json');
export const get_article_html = (folder: string) =>
  path.join(folder, 'article.html');
export const get_processed_json = (folder: string) =>
  path.join(folder, 'processed.json');

export class WebPageContent {
  constructor(
    public headline: string,
    public content: string,
    public distilled: any,
    public processed: any | null = null
  ) {}

  static fromDistillationResult(result: any): WebPageContent {
    const [headline, content] = this.parseDistillationResult(result);
    return new WebPageContent(headline, content, result);
  }

  // Returns headline and content.
  private static parseDistillationResult(result: any): [string, string] {
    return [result['1'], result['2']['1']];
  }

  async write(folder: string) {
    const content_file = get_content_json(folder);
    await writeFileAsync(
      content_file,
      JSON.stringify(
        { headline: this.headline, content: this.content },
        null,
        2
      ),
      'utf8'
    );
    const result_file = get_domdistiller_json(folder);
    await writeFileAsync(
      result_file,
      JSON.stringify(this.distilled, null, 2),
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
    const html_file = get_article_html(folder);
    await writeFileAsync(html_file, content_html, 'utf8');
    await writeFileAsync(
      get_processed_json(folder),
      JSON.stringify(this.processed, null, 2),
      'utf8'
    );
  }

  static async fromFolder(folder: string): Promise<WebPageContent> {
    const result_file = get_domdistiller_json(folder);
    const result = JSON.parse(
      await readFileAsync(result_file, { encoding: 'utf8' })
    );
    return WebPageContent.fromDistillationResult(result);
  }
}
