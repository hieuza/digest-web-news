import { readFile, writeFile, existsSync } from 'fs';
import path from 'path';
import { promisify } from 'util';

const writeFileAsync = promisify(writeFile);
const readFileAsync = promisify(readFile);

// Describes a fetched web page folder.
export class PageFolder {
  constructor(public folder: string) {}

  get_file = (filename: string) => path.join(this.folder, filename);

  story_file = () => this.get_file('story.json');
  content_file = () => this.get_file('article.json');
  distillation_file = () => this.get_file('distillation.json');
  article_html = () => this.get_file('article.html');
  processed_file = () => this.get_file('processed.json');
}

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
    const content_file = new PageFolder(folder).content_file();
    await writeFileAsync(
      content_file,
      JSON.stringify(
        { headline: this.headline, content: this.content },
        null,
        2
      ),
      'utf8'
    );
    const result_file = new PageFolder(folder).distillation_file();
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
    const html_file = new PageFolder(folder).article_html();
    await writeFileAsync(html_file, content_html, 'utf8');
    await writeFileAsync(
      new PageFolder(folder).processed_file(),
      JSON.stringify(this.processed, null, 2),
      'utf8'
    );
  }

  static async fromFolder(folder: string): Promise<WebPageContent> {
    const result_file = new PageFolder(folder).distillation_file();
    const result = JSON.parse(
      await readFileAsync(result_file, { encoding: 'utf8' })
    );
    return WebPageContent.fromDistillationResult(result);
  }
}
