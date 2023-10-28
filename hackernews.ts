const HN_BESTSTORIES =
  'https://hacker-news.firebaseio.com/v0/beststories.json?print=pretty';
const HN_TOPSTORIES =
  'https://hacker-news.firebaseio.com/v0/topstories.json?print=pretty';

// Each Story is an object with property: url, title, id, time, etc.
type Story = any;

export class HackerNews {
  // Returns a list of top stories objects.
  static fetchTopStories = async () => this.fetchStories(HN_TOPSTORIES);

  // Returns a list of best stories objects.
  static fetchBestStories = async () => this.fetchStories(HN_BESTSTORIES);

  static async fetchStories(url: string): Promise<Story[]> {
    const itemIds = await this.fetchJson(url);
    const stories = [];
    for (const itemId of itemIds) {
      const story = await this.fetchItemJson(itemId);
      // Keep the type `story` only.
      if (story.type === 'story') {
        stories.push(story);
      }
    }
    return stories;
  }

  static fetchItemJson = async (itemId: number) =>
    this.fetchJson(
      `https://hacker-news.firebaseio.com/v0/item/${itemId}.json?print=pretty`
    );

  static fetchJson = async (url: string) => (await fetch(url)).json();
}
