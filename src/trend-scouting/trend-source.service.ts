import type { TrendSignal } from "./trend-scouting.types";

const DEFAULT_RSS_URLS = [
  "https://trends.google.com/trends/trendingsearches/daily/rss?geo=US",
  "https://trends.google.com/trending/rss?geo=US",
];

export class TrendSourceService {
  async fetchSignals(limit = 20): Promise<TrendSignal[]> {
    const urls = this.urlsFromEnv();
    for (const url of urls) {
      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent":
              "short-video-bot/1.0 (+local trend scouting; contact: local)",
          },
        });
        if (!response.ok) continue;

        const xml = await response.text();
        const signals = this.parseRss(xml, url).slice(0, limit);
        if (signals.length > 0) return signals;
      } catch {
        continue;
      }
    }

    return [];
  }

  private urlsFromEnv(): string[] {
    const custom = process.env.TREND_SCOUT_RSS_URLS
      ?.split(",")
      .map((url) => url.trim())
      .filter(Boolean);
    return custom?.length ? custom : DEFAULT_RSS_URLS;
  }

  private parseRss(xml: string, source: string): TrendSignal[] {
    const items = xml.match(/<item\b[\s\S]*?<\/item>/giu) ?? [];
    return items
      .map<TrendSignal | undefined>((item) => {
        const title = this.textFromTag(item, "title");
        if (!title) return undefined;

        const relatedQueries = [
          ...this.repeatedTextFromTag(item, "ht:news_item_title"),
          ...this.repeatedTextFromTag(item, "ht:news_item_source"),
          ...this.repeatedTextFromTag(item, "description"),
        ]
          .map((value) => this.clean(value))
          .filter(Boolean)
          .slice(0, 8);

        const signal: TrendSignal = {
          title: this.clean(title),
          source,
          relatedQueries,
        };
        const traffic = this.textFromTag(item, "ht:approx_traffic");
        const url = this.textFromTag(item, "link");
        if (traffic) signal.traffic = traffic;
        if (url) signal.url = url;
        return signal;
      })
      .filter((signal): signal is TrendSignal => Boolean(signal));
  }

  private textFromTag(item: string, tag: string): string | undefined {
    return this.repeatedTextFromTag(item, tag)[0];
  }

  private repeatedTextFromTag(item: string, tag: string): string[] {
    const escapedTag = tag.replace(/:/gu, "\\:");
    const pattern = new RegExp(`<${escapedTag}[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`, "giu");
    return Array.from(item.matchAll(pattern), (match) => this.decode(match[1] ?? ""));
  }

  private clean(value: string): string {
    return value.replace(/\s+/gu, " ").trim();
  }

  private decode(value: string): string {
    return value
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gu, "$1")
      .replace(/&amp;/gu, "&")
      .replace(/&lt;/gu, "<")
      .replace(/&gt;/gu, ">")
      .replace(/&quot;/gu, "\"")
      .replace(/&#39;/gu, "'");
  }
}
