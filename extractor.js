"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.Distiller = exports.WebPageContent = void 0;
const puppeteer = __importStar(require("puppeteer-core"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const util_1 = require("util");
const readFileAsync = (0, util_1.promisify)(fs_1.readFile);
const writeFileAsync = (0, util_1.promisify)(fs_1.writeFile);
const CHROME_BINARY = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DD_SCRIPT_PATH = './domdistiller.js';
class WebPageContent {
    constructor(headline, content, result) {
        this.headline = headline;
        this.content = content;
        this.result = result;
    }
    write(folder) {
        return __awaiter(this, void 0, void 0, function* () {
            const content_file = path_1.default.join(folder, 'article.txt');
            yield writeFileAsync(content_file, `${this.headline}\n${this.content}`, 'utf8');
            const result_file = path_1.default.join(folder, 'article.json');
            yield writeFileAsync(result_file, JSON.stringify(this.result, null, 2), 'utf8');
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
            const html_file = path_1.default.join(folder, 'article.html');
            yield writeFileAsync(html_file, content_html, 'utf8');
        });
    }
}
exports.WebPageContent = WebPageContent;
class Distiller {
    constructor(browser, domDistillerScript) {
        this.browser = browser;
        this.domDistillerScript = domDistillerScript;
    }
    static create() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Distiller.distiller) {
                const browser = yield puppeteer.launch({
                    executablePath: CHROME_BINARY,
                    headless: true,
                });
                // Get DOM Distiller Script.
                const domDistillerScript = yield readFileAsync(DD_SCRIPT_PATH, {
                    encoding: 'utf8',
                });
                Distiller.distiller = new Distiller(browser, domDistillerScript);
            }
            return Distiller.distiller;
        });
    }
    fetchPage(url) {
        return __awaiter(this, void 0, void 0, function* () {
            const page = yield this.browser.newPage();
            yield page.goto(url);
            yield page.evaluate(this.domDistillerScript);
            // 1 = extract_text_only: true
            // 2 = debug_level: 0 -- log nothing. 3 -- everything.
            // 3 = original_url
            const result = yield page.evaluate(`
        var options = { 1: false, 2:0, 3: "${url}" };
        org.chromium.distiller.DomDistiller.applyWithOptions(options);
    `);
            yield page.close();
            const headline = result['1'];
            const content = result['2']['1'];
            return new WebPageContent(headline, content, result);
        });
    }
    closeBrowser() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.browser.close();
        });
    }
}
exports.Distiller = Distiller;
// (async () => {
//   const distiller = await Distiller.create();
//   // const URL = 'https://www.bbc.com/news/technology-66618852';
//   const URL = 'https://www.bbc.co.uk/news/technology-64285227';
//   // const URL = 'https://www.bbc.co.uk/news/technology-62788725';
//   const distilled = await distiller.fetchPage(URL);
//   console.log(distilled.headline);
//   console.log(distilled.content);
//   const { headline, content, result } = distilled;
//   const content_file = '/tmp/article.txt';
//   await writeFileAsync(content_file, `${headline}\n${content}`, 'utf8');
//   const result_file = '/tmp/article.json';
//   await writeFileAsync(result_file, JSON.stringify(result, null, 2), 'utf8');
//   const content_html = `<html><body><h1>${headline}</h1>${content}</body></html>`;
//   const html_file = '/tmp/article.html';
//   await writeFileAsync(html_file, content_html, 'utf8');
//   distiller.closeBrowser();
// })();
