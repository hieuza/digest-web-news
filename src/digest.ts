import { WebPageContent } from './page_content';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GENAI_MODEL = 'gemini-3.8-flash';
const MAX_INPUT_TOKENS = 16000;
const MAX_OUTPUT_TOKENS = 8192;

// For a given page content, summarise it and classify the topics.
export class Digestor {
  private static model = (() => {
    const model_name = process.env.GENAI_MODEL || GENAI_MODEL;
    const apiKey = process.env.GOOGLE_API_KEY;
    const systemInstruction = `You are an expert technical digest editor.
Your task is to synthesize the core substance of articles into direct, informative executive digests.

Rules for style and tone:
1. Direct Declarative Voice: Present key insights, findings, technical mechanisms, and arguments directly. If the author asserts that X is Y, state "X is Y".
2. Strict Zero Meta-Language: NEVER use third-person attributions such as "The article states / discusses / explains...", "The author argues / believes / suggests...", "This post covers...", or "According to the text...".
3. Information-Dense & Concise: Focus on what was built, discovered, or argued with concrete details, technologies, and conclusions in 3-5 clear sentences.
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
Generate a JSON object based on the article provided below:

{
  "full_content": <true if the article content is correctly associated with the title, false if the content is an error message, paywall block, or fetch failure>,
  "summary": "<Direct 3-5 sentence summary stating the core findings and arguments directly. Absolutely NO 3rd-person attributions like 'The article discusses...' or 'The author states...'>",
  "tags": ["<topic1>", "<topic2>", "<topic3>"],
  "about_ai": <true if the article is about Artificial Intelligence or Machine Learning, false otherwise>
}

Article Details:
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
