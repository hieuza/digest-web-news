import { WebPageContent } from './page_content';
import OpenAI from 'openai';

// For a given page content, summarise it and classify the topics.
export class Digestor {
  private static openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  static async processFolder(folder: string): Promise<void> {
    const page = await WebPageContent.fromFolder(folder);
    if (!page) return;

    const processed = await this.processPage(page);
    console.log(processed);
  }

  static async processPage(page: WebPageContent): Promise<string | null> {
    const systemPrompt = `You are an helpful assistant.
You read the article carefully, process its content and give me the main information to help me understand the article faster.
`;
    const prompt = `
Given an article of format:
<HEADLINE>
article headline
</HEADLINE>
<CONTENT>
multiple-line article content
</CONTENT>

Please generate the JSON file with the following information and format:
{
  summary: "<article summary in about max 5 sentences>",
  tags: [comma-separated list of hashtags of the main topic of the articles],
  about_ai: true/false depending on whether the article is about Artificial Intelligence.
}
Please generate the JSON information only, nothing else. The article started below.

<HEADLINE>
${page.headline}
</HEADLINE>
<CONTENT>
${page.content}
</CONTENT>

Your answer:
`;

    const response = await Digestor.openai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      model: 'gpt-3.5-turbo',
    });
    return response.choices[0].message.content;
  }
}
