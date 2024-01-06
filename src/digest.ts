import { WebPageContent } from './page_content';
import OpenAI from 'openai';

const OPENAI_MODEL = 'gpt-3.5-turbo-1106'; // Use cheap option now :)
const MAX_INPUT_TOKENS = 16000;
const MAX_OUTPUT_TOKENS = 1024;

// For a given page content, summarise it and classify the topics.
export class Digestor {
  private static openai = (() => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      return new OpenAI({ apiKey: apiKey });
    } else {
      console.error(
        'OPENAI_API_KEY is missing. No article content processing.'
      );
      return null;
    }
  })();

  static async processFolder(folder: string): Promise<string | null> {
    const page = await WebPageContent.fromFolder(folder);
    if (!page) null;

    return await this.processPage(page);
  }

  static async processPage(page: WebPageContent): Promise<string | null> {
    if (!this.openai) {
      console.warn('Missing OpenAI API Key. No processing.');
      return null;
    }
    if (page.content.length / 4 > MAX_INPUT_TOKENS) {
      console.warn('Article too long. More than token limit. Ignore');
      return null;
    }

    const systemPrompt = `You are an helpful assistant.
You read the given article carefully, process its content and give me the main information (in direct summarization style) to help me understand the article faster.
A direct summarization means to describe the content directly as you are the author of the article. You rewrite the main points of the article in the precise and concise way.
`;
    const prompt = `
Please generate the JSON file with the following information and format:
{
  summary: "<direct summary with the most important points in about 3-5 sentences.>",
  tags: [comma-separated list of the main topic of the articles],
  about_ai: true/false depending on whether the article is about Artificial Intelligence.
}

The article is given below:
Title:
${page.headline}
Content:
${page.content}
`;

    const response = await this.openai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      model: OPENAI_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      response_format: { type: 'json_object' },
    });
    return response.choices[0].message.content;
  }
}
