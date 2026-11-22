import { WebPageContent } from './page_content';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { parseProcessedJson } from './db';

const GENAI_MODEL = 'gemini-4-neon';
const GENAI_THINKING_LEVEL = 'MEDIUM';
const MAX_INPUT_TOKENS = 16000;
const MAX_OUTPUT_TOKENS = 32768;

const SYSTEM_INSTRUCTION = `You are an expert technical digest editor.
Your task is to synthesize the core substance of articles into direct, informative executive digests.

Rules for style and tone:
1. Direct Declarative Voice: Present key insights, findings, technical mechanisms, and arguments directly. If the author asserts that X is Y, state "X is Y".
2. Strict Zero Meta-Language: NEVER use third-person attributions such as "The article states / discusses / explains...", "The author argues / believes / suggests...", "This post covers...", or "According to the text...".
3. Information-Dense & Concise: Focus on what was built, discovered, or argued with concrete details, technologies, and conclusions in 3-5 clear sentences.
`;

export interface GenerativeModelLike {
  generateContent(prompt: string): Promise<{ response: { text: () => string } }>;
  generateContentStream?(prompt: string): Promise<{
    stream: AsyncIterable<any>;
    response: Promise<{ text: () => string }>;
  }>;
}

// For a given page content, summarise it and classify the topics.
export class Digestor {
  private static customModel: GenerativeModelLike | null = null;
  private static defaultModel: any = null;

  static setModel(model: GenerativeModelLike | null) {
    this.customModel = model;
  }

  static normalizeGoogleModel(modelName: string): string {
    return modelName.replace(/^models\//, '').replace(/^google\//, '');
  }

  static normalizeOpenRouterModel(modelName: string): string {
    const cleaned = modelName.replace(/^models\//, '');
    return cleaned.includes('/') ? cleaned : `google/${cleaned}`;
  }

  static resolveThinkingLevel(thinkingLevel?: string): string {
    return (thinkingLevel || process.env.GENAI_THINKING_LEVEL || GENAI_THINKING_LEVEL).trim().toUpperCase();
  }

  static buildOpenRouterPayload(
    prompt: string,
    systemInstruction: string,
    modelName: string,
    thinkingLevel?: string
  ): Record<string, any> {
    const googleModel = this.normalizeGoogleModel(modelName);
    const targetModel = this.normalizeOpenRouterModel(modelName);
    const resolvedThinking = this.resolveThinkingLevel(thinkingLevel);
    const supportsThinking = googleModel.startsWith('gemini-4-');
    const effort = resolvedThinking.toLowerCase();

    return {
      model: targetModel,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt },
      ],
      max_tokens: MAX_OUTPUT_TOKENS,
      response_format: { type: 'json_object' },
      ...(supportsThinking
        ? { reasoning: { effort: effort === 'off' || effort === 'disabled' ? 'none' : effort, exclude: true } }
        : {}),
    };
  }

  static getModel(): GenerativeModelLike | null {
    if (this.customModel !== null) {
      return this.customModel;
    }
    if (!this.defaultModel) {
      const model_name = this.normalizeGoogleModel(process.env.GENAI_MODEL || GENAI_MODEL);
      const apiKey = process.env.GOOGLE_API_KEY;
      if (apiKey) {
        const genAI = new GoogleGenerativeAI(apiKey);
        const thinkingLevel = this.resolveThinkingLevel();
        this.defaultModel = genAI.getGenerativeModel({
          model: model_name,
          systemInstruction: SYSTEM_INSTRUCTION,
          generationConfig: {
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            responseMimeType: 'application/json',
            ...(model_name.startsWith('gemini-4-') ? { thinkingConfig: { thinkingLevel } } : {}),
          } as any,
        });
      } else {
        console.error(
          'GOOGLE_API_KEY is missing. No article content processing.'
        );
        return null;
      }
    }
    return this.defaultModel;
  }

  static async callOpenRouter(prompt: string, systemInstruction: string, modelName: string): Promise<string | null> {
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterKey) return null;

    const payload = this.buildOpenRouterPayload(prompt, systemInstruction, modelName);
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openrouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/hieuza/digest-web-news',
          'X-Title': 'Digest Web News',
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[Digestor] OpenRouter HTTP ${response.status}: ${errText}`);
        return null;
      }
      const data: any = await response.json();
      return data.choices?.[0]?.message?.content || null;
    } catch (err: any) {
      console.warn(`[Digestor] OpenRouter request failed: ${err.message}`);
      return null;
    }
  }

  static async processFolder(folder: string): Promise<string | null> {
    const page = await WebPageContent.fromFolder(folder);
    if (!page) return null;

    return await this.processPage(page);
  }

  static async processPage(page: WebPageContent): Promise<string | null> {
    const model_name = process.env.GENAI_MODEL || GENAI_MODEL;

    if (!page.content || page.content.length / 4 > MAX_INPUT_TOKENS) {
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

    const model = this.getModel();
    if (!model) {
      console.warn('No generative model. No processing.');
      return null;
    }

    try {
      if (typeof model.generateContentStream === 'function') {
        const streamRes = await model.generateContentStream(prompt);
        for await (const _chunk of streamRes.stream) {
          // Drain stream so headers arrive immediately during thinking.
        }
        const response = await streamRes.response;
        return response.text();
      }
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err: any) {
      const status = err?.status || err?.statusCode;
      const msg = String(err?.message || err).toLowerCase();
      const isFallbackEligible =
        status === 402 ||
        status === 429 ||
        status === 408 ||
        (typeof status === 'number' && status >= 500) ||
        msg.includes('402') ||
        msg.includes('depleted') ||
        msg.includes('resource_exhausted') ||
        msg.includes('fetch failed') ||
        msg.includes('timeout');
      if (isFallbackEligible && process.env.OPENROUTER_API_KEY) {
        console.warn(`[Digestor] Google API error (${err.message}). Falling back to OpenRouter for this request...`);
        return await this.callOpenRouter(prompt, SYSTEM_INSTRUCTION, model_name);
      }
      throw err;
    }
  }

  // Print processed info if it contains the full content.
  static printProcessed(processed: string | null) {
    if (!processed) return;
    const parsed = parseProcessedJson(processed);
    if (parsed.full_content === 1) {
      console.log(parsed.summary);
      console.log(
        'Tags:',
        parsed.tags.join(', '),
        parsed.about_ai === 1 ? ' | AI' : ''
      );
    }
  }
}
