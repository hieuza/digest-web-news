"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Digestor = void 0;
const page_content_1 = require("./page_content");
const openai_1 = __importDefault(require("openai"));
// For a given page content, summarise it and classify the topics.
class Digestor {
    static processFolder(folder) {
        return __awaiter(this, void 0, void 0, function* () {
            const page = yield page_content_1.WebPageContent.fromFolder(folder);
            if (!page)
                return;
            const processed = yield this.processPage(page);
            console.log(processed);
        });
    }
    static processPage(page) {
        return __awaiter(this, void 0, void 0, function* () {
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
            const response = yield Digestor.openai.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt },
                ],
                model: 'gpt-3.5-turbo',
            });
            return response.choices[0].message.content;
        });
    }
}
exports.Digestor = Digestor;
Digestor.openai = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY });
