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
const extractor_1 = require("./extractor");
const digest_1 = require("./digest");
const argv = yargs_1.default.options({
    url: { type: 'string', demandOption: true },
    output_dir: { type: 'string', demandOption: false },
    extract_text_only: { type: 'boolean', default: false },
}).argv;
extractor_1.Distiller.perform({ extractTextOnly: argv.extract_text_only }, (distiller) => __awaiter(void 0, void 0, void 0, function* () {
    const url = argv.url;
    console.log('URL:', url);
    const page = yield distiller.distilPage(url);
    console.log(page.headline);
    console.log(page.content);
    const processed = yield digest_1.Digester.processPage(page);
    console.log('-'.repeat(80));
    console.log(processed);
    page.processed = processed;
    if (argv.output_dir) {
        if (!fs.existsSync(argv.output_dir)) {
            fs.mkdirSync(argv.output_dir, { recursive: true });
        }
        console.log(`Output articles to ${argv.output_dir}`);
        yield page.write(argv.output_dir);
    }
}));
