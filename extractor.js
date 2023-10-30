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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Distiller = void 0;
const puppeteer = __importStar(require("puppeteer"));
const fs_1 = require("fs");
const util_1 = require("util");
const page_content_1 = require("./page_content");
const readFileAsync = (0, util_1.promisify)(fs_1.readFile);
const DD_SCRIPT_PATH = './domdistiller.js';
class Distiller {
    constructor(browser, domDistillerScript, extractTextOnly) {
        this.browser = browser;
        this.domDistillerScript = domDistillerScript;
        this.extractTextOnly = extractTextOnly;
    }
    static create(options = { extractTextOnly: false }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Distiller.distiller) {
                const browser = yield puppeteer.launch({ headless: 'new' });
                // Get DOM Distiller Script.
                const domDistillerScript = yield readFileAsync(DD_SCRIPT_PATH, {
                    encoding: 'utf8',
                });
                Distiller.distiller = new Distiller(browser, domDistillerScript, options.extractTextOnly);
            }
            return Distiller.distiller;
        });
    }
    static perform(options, task) {
        return __awaiter(this, void 0, void 0, function* () {
            const distiller = yield this.create(options);
            try {
                yield task(distiller);
            }
            finally {
                distiller.closeBrowser();
            }
        });
    }
    distilPage(url) {
        return __awaiter(this, void 0, void 0, function* () {
            const page = yield this.browser.newPage();
            yield page.goto(url);
            yield page.evaluate(this.domDistillerScript);
            // https://github.com/chromium/dom-distiller-dist/blob/main/proto/dom_distiller.proto
            // 1 = extract_text_only: true
            // 2 = debug_level: 0 -- log nothing. 3 -- everything.
            // 3 = original_url
            const result = yield page.evaluate(`
        var options = { 1: ${this.extractTextOnly}, 2:0, 3: "${url}" };
        org.chromium.distiller.DomDistiller.applyWithOptions(options);
    `);
            yield page.close();
            return page_content_1.WebPageContent.fromDistillationResult(result);
        });
    }
    closeBrowser() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.browser.close();
        });
    }
}
exports.Distiller = Distiller;
