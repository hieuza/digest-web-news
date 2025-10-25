import { WebPageContent } from './page_content';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GENAI_MODEL = 'gemini-2.5-flash';
const MAX_INPUT_TOKENS = 16000;
const MAX_OUTPUT_TOKENS = 1024;

// For a given page content, summarise it and classify the topics.
export class Digestor {
  private static model = (() => {
    const model_name = process.env.GENAI_MODEL || GENAI_MODEL;
    const apiKey = process.env.GOOGLE_API_KEY;
    const systemInstruction = `You are an helpful assistant.
You read the given article carefully, process its content and give me the main information (in direct summarization style) to help me understand the article faster.
A direct summarization means to describe the content directly as you are the author of the article. You rewrite the main points of the article in the precise and concise way.
`;
    if (apiKey) {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: model_name,
        systemInstruction: systemInstruction,
        generationConfig: {
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          responseMimeType: 'application/json',
        },
      });
      return model;
    } else {
      console.error(
        'GOOGLE_API_KEY is missing. No article content processing.'
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
Please generate a JSON file with the following structure based on the article provided below:

{
  "full_content": <true if the article content is correctly associated with the title, false if the content is a failure message of page fetching>,
  "summary": "<A concise summary of the article, highlighting the most important points in 3-5 sentences>",
  "tags": ["<comma-separated list of the main topics of the article>"],
  "about_ai": <true if the article is about Artificial Intelligence, false otherwise>
}

The article details are as follows:
Title:
${page.headline}
Content:
${page.content}
`;

    const result = await this.model.generateContent(prompt);
    return result.response.text();
  }

  // Print processed info if it contains the full content.
  static printProcessed(processed: string | null) {
    if (!processed) return;
    const processed_json = JSON.parse(processed);
    if (processed_json?.full_content) {
      console.log(processed_json.summary);
      console.log(
        'Tags:',
        processed_json.tags.join(', '),
        processed_json.about_ai ? ' | AI' : ''
      );
    }
  }
}
