import { WebPageContent } from './page_content';
import OpenAI from 'openai';

// For a given page content, summarise it and classify the topics.
export class Digestor {
  private static openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  static async processFolder(folder: string): Promise<string | null> {
    const page = await WebPageContent.fromFolder(folder);
    if (!page) null;

    return await this.processPage(page);
  }

  static async processPage(page: WebPageContent): Promise<string | null> {
    const systemPrompt = `You are an helpful assistant.
You read the given article carefully, process its content and give me the main information to help me understand the article faster.
`;
    const prompt = `
Please generate the JSON file with the following information and format:
{
  summary: "<direct summary with the most important points in about 3-5 sentences>",
  tags: [comma-separated list of the main topic of the articles],
  about_ai: true/false depending on whether the article is about Artificial Intelligence.
}

The article is given below:
Title:
${page.headline}
Content:
${page.content}
`;

    const response = await Digestor.openai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      model: 'gpt-3.5-turbo-1106',
      response_format: { type: 'json_object' },
    });
    return response.choices[0].message.content;
  }
}
