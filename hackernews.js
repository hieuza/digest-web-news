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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HackerNews = void 0;
const HN_BESTSTORIES = 'https://hacker-news.firebaseio.com/v0/beststories.json?print=pretty';
const HN_TOPSTORIES = 'https://hacker-news.firebaseio.com/v0/topstories.json?print=pretty';
class HackerNews {
    static fetchStories(url) {
        return __awaiter(this, void 0, void 0, function* () {
            const itemIds = yield this.fetchJson(url);
            const stories = [];
            for (const itemId of itemIds) {
                const story = yield this.fetchItemJson(itemId);
                // Keep the type `story` only.
                if (story.type === 'story') {
                    stories.push(story);
                }
            }
            return stories;
        });
    }
}
exports.HackerNews = HackerNews;
_a = HackerNews;
// Returns a list of top stories objects.
HackerNews.fetchTopStories = () => __awaiter(void 0, void 0, void 0, function* () { return _a.fetchStories(HN_TOPSTORIES); });
// Returns a list of best stories objects.
HackerNews.fetchBestStories = () => __awaiter(void 0, void 0, void 0, function* () { return _a.fetchStories(HN_BESTSTORIES); });
HackerNews.fetchItemJson = (itemId) => __awaiter(void 0, void 0, void 0, function* () {
    return _a.fetchJson(`https://hacker-news.firebaseio.com/v0/item/${itemId}.json?print=pretty`);
});
HackerNews.fetchJson = (url) => __awaiter(void 0, void 0, void 0, function* () { return (yield fetch(url)).json(); });
