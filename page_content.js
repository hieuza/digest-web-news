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
exports.WebPageContent = exports.get_processed_json = exports.get_article_html = exports.get_domdistiller_json = exports.get_content_json = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const util_1 = require("util");
const writeFileAsync = (0, util_1.promisify)(fs_1.writeFile);
const readFileAsync = (0, util_1.promisify)(fs_1.readFile);
// Clean this part.
const get_content_json = (folder) => path_1.default.join(folder, 'article.json');
exports.get_content_json = get_content_json;
const get_domdistiller_json = (folder) => path_1.default.join(folder, 'distillation.json');
exports.get_domdistiller_json = get_domdistiller_json;
const get_article_html = (folder) => path_1.default.join(folder, 'article.html');
exports.get_article_html = get_article_html;
const get_processed_json = (folder) => path_1.default.join(folder, 'processed.json');
exports.get_processed_json = get_processed_json;
class WebPageContent {
    constructor(headline, content, distilled, processed = null) {
        this.headline = headline;
        this.content = content;
        this.distilled = distilled;
        this.processed = processed;
    }
    static fromDistillationResult(result) {
        const [headline, content] = this.parseDistillationResult(result);
        return new WebPageContent(headline, content, result);
    }
    // Returns headline and content.
    static parseDistillationResult(result) {
        return [result['1'], result['2']['1']];
    }
    write(folder) {
        return __awaiter(this, void 0, void 0, function* () {
            const content_file = (0, exports.get_content_json)(folder);
            yield writeFileAsync(content_file, JSON.stringify({ headline: this.headline, content: this.content }, null, 2), 'utf8');
            const result_file = (0, exports.get_domdistiller_json)(folder);
            yield writeFileAsync(result_file, JSON.stringify(this.distilled, null, 2), 'utf8');
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
            const html_file = (0, exports.get_article_html)(folder);
            yield writeFileAsync(html_file, content_html, 'utf8');
            yield writeFileAsync((0, exports.get_processed_json)(folder), JSON.stringify(this.processed, null, 2), 'utf8');
        });
    }
    static fromFolder(folder) {
        return __awaiter(this, void 0, void 0, function* () {
            const result_file = (0, exports.get_domdistiller_json)(folder);
            const result = JSON.parse(yield readFileAsync(result_file, { encoding: 'utf8' }));
            return WebPageContent.fromDistillationResult(result);
        });
    }
}
exports.WebPageContent = WebPageContent;
