import { WebPageContent } from './page_content';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GENAI_MODEL = 'gemini-1.5-flash';
const MAX_INPUT_TOKENS = 16000;
const MAX_OUTPUT_TOKENS = 1024;

// For a given page content, summarise it and classify the topics.
export class Digestor {
  private static model = (() => {
    const apiKey = process.env.GOOGLE_API_KEY;
    const systemInstruction = `You are an helpful assistant.
You read the given article carefully, process its content and give me the main information (in direct summarization style) to help me understand the article faster.
A direct summarization means to describe the content directly as you are the author of the article. You rewrite the main points of the article in the precise and concise way.
`;
    if (apiKey) {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: GENAI_MODEL,
        systemInstruction: systemInstruction,
        generationConfig: {
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          responseMimeType: 'application/json',
        },
      });
      return model;
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
    if (!this.model) {
      console.warn('No generative model. No processing.');
      return null;
    }
    if (page.content.length / 4 > MAX_INPUT_TOKENS) {
      console.warn('Article too long. More than token limit. Ignore');
      return null;
    }

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

    const result = await this.model.generateContent(prompt);
    return result.response.text();
  }
}
