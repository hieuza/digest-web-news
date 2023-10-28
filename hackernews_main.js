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
const yargs_1 = __importDefault(require("yargs"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const util_1 = require("util");
const extractor_1 = require("./extractor");
const hackernews_1 = require("./hackernews");
const writeFileAsync = (0, util_1.promisify)(fs.writeFile);
const argv = yargs_1.default.options({
    output_dir: {
        type: 'string',
        demandOption: true,
        default: '/tmp/hackernews',
    },
}).argv;
const createFolder = (folder) => {
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
    }
};
(() => __awaiter(void 0, void 0, void 0, function* () {
    const distiller = yield extractor_1.Distiller.create();
    const stories = yield hackernews_1.HackerNews.fetchBestStories();
    for (const story of stories) {
        const url = story.url;
        const storyId = story.id;
        console.log(`${storyId} | ${story.title} | ${url}`);
        if (!url) {
            console.log(JSON.stringify(story));
            continue;
        }
        const outputFolder = path.join(argv.output_dir, storyId.toString());
        const outputStoryJsonFile = path.join(outputFolder, 'story.json');
        // Ignore if the content was distilled.
        if (fs.existsSync(outputStoryJsonFile))
            continue;
        try {
            const distilledPage = yield distiller.fetchPage(url);
            createFolder(outputFolder);
            yield distilledPage.write(outputFolder);
            writeFileAsync(outputStoryJsonFile, JSON.stringify(story, null, 2), 'utf8');
        }
        catch (error) {
            console.log('Error:', error);
        }
    }
    // TODO: How to auto close it? Forget to close and it will hang.
    yield distiller.closeBrowser();
}))();
