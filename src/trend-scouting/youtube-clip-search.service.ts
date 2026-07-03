import { google, youtube_v3 } from "googleapis";
import type { ResolvedClipCandidate } from "./trend-scouting.types";

interface VideoDetails {
  id: string;
  title: string;
  creator: string;
  publishedAt?: string;
  viewCount?: number;
  likeCount?: number;
  durationSeconds?: number;
}

export class YouTubeClipSearchService {
  private readonly apiKey = process.env.YOUTUBE_SEARCH_API_KEY || "";

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async search(
    query: string,
    options?: { maxResults?: number },
  ): Promise<ResolvedClipCandidate[]> {
    if (!this.apiKey) return [];

    const youtube = google.youtube({
      version: "v3",
      auth: this.apiKey,
    });
    const searchResponse = await youtube.search.list({
      part: ["snippet"],
      q: `${query} shorts`,
      type: ["video"],
      videoDuration: "short",
      order: "relevance",
      maxResults: options?.maxResults ?? 8,
      safeSearch: "moderate",
      relevanceLanguage: "en",
    });

    const ids = (searchResponse.data.items ?? [])
      .map((item) => item.id?.videoId)
      .filter((id): id is string => Boolean(id));
    if (ids.length === 0) return [];

    const details = await this.fetchVideoDetails(youtube, ids);
    return details
      .filter((video) => this.isLikelyShort(video))
      .map((video) => this.toResolvedClip(video, query))
      .sort((left, right) => right.score - left.score);
  }

  private async fetchVideoDetails(
    youtube: youtube_v3.Youtube,
    ids: string[],
  ): Promise<VideoDetails[]> {
    const response = await youtube.videos.list({
      part: ["snippet", "statistics", "contentDetails"],
      id: ids,
      maxResults: ids.length,
    });

    return (response.data.items ?? []).map((item) => {
      const statistics = item.statistics;
      const snippet = item.snippet;
      return {
        id: item.id || "",
        title: snippet?.title || "Untitled video",
        creator: snippet?.channelTitle || "Unknown creator",
        publishedAt: snippet?.publishedAt || undefined,
        viewCount: this.numberFromString(statistics?.viewCount),
        likeCount: this.numberFromString(statistics?.likeCount),
        durationSeconds: this.parseIsoDuration(item.contentDetails?.duration),
      };
    });
  }

  private isLikelyShort(video: VideoDetails): boolean {
    if (!video.id) return false;
    if (video.durationSeconds && video.durationSeconds > 75) return false;
    return true;
  }

  private toResolvedClip(
    video: VideoDetails,
    sourceQuery: string,
  ): ResolvedClipCandidate {
    const score = this.score(video);
    return {
      platform: "YouTube Shorts",
      title: video.title,
      url: `https://www.youtube.com/shorts/${video.id}`,
      creator: video.creator,
      publishedAt: video.publishedAt,
      viewCount: video.viewCount,
      likeCount: video.likeCount,
      durationSeconds: video.durationSeconds,
      score,
      sourceQuery,
      recommendationReason:
        `Short relacionado con "${sourceQuery}"` +
        (video.viewCount ? `, ${video.viewCount.toLocaleString("en-US")} views` : "") +
        (video.durationSeconds ? `, ${Math.round(video.durationSeconds)}s` : ""),
    };
  }

  private score(video: VideoDetails): number {
    const views = video.viewCount ?? 0;
    const likes = video.likeCount ?? 0;
    const duration = video.durationSeconds ?? 60;
    const viewScore = Math.min(70, Math.log10(Math.max(views, 1)) * 12);
    const likeScore = Math.min(18, Math.log10(Math.max(likes, 1)) * 5);
    const durationScore = duration <= 35 ? 12 : duration <= 60 ? 8 : 3;
    return Math.round(viewScore + likeScore + durationScore);
  }

  private numberFromString(value?: string | null): number | undefined {
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private parseIsoDuration(value?: string | null): number | undefined {
    if (!value) return undefined;
    const match = value.match(
      /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/u,
    );
    if (!match) return undefined;
    const days = Number(match[1] ?? 0);
    const hours = Number(match[2] ?? 0);
    const minutes = Number(match[3] ?? 0);
    const seconds = Number(match[4] ?? 0);
    return days * 86_400 + hours * 3_600 + minutes * 60 + seconds;
  }
}
