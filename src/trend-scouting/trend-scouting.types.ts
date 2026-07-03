export type TrendPlatform = "TikTok" | "YouTube Shorts" | "Instagram Reels";

export interface TrendTopic {
  id: string;
  title: string;
  category: string;
  angle: string;
  baseScore: number;
  safetyScore: number;
  retentionScore: number;
  clipAvailabilityScore: number;
  keywords: string[];
  avoid: string[];
}

export interface TrendSignal {
  title: string;
  source: string;
  traffic?: string;
  url?: string;
  relatedQueries: string[];
}

export interface ClipReviewCandidate {
  rank: number;
  hook: string;
  clipBrief: string;
  idealDurationSeconds: string;
  searchQueries: string[];
  searchUrls: string[];
  platforms: TrendPlatform[];
  selectionNotes: string[];
  resolvedClips?: ResolvedClipCandidate[];
}

export interface ResolvedClipCandidate {
  platform: "YouTube Shorts";
  title: string;
  url: string;
  creator: string;
  publishedAt?: string;
  viewCount?: number;
  likeCount?: number;
  durationSeconds?: number;
  score: number;
  sourceQuery: string;
  recommendationReason: string;
}

export interface TopProposal {
  rank: number;
  score: number;
  title: string;
  category: string;
  angle: string;
  whyThisCanWork: string[];
  suggestedVideoTitle: string;
  voiceoverStyle: string;
  candidateClips: ClipReviewCandidate[];
  hashtags: string[];
  trendSignals?: TrendSignal[];
}

export interface TrendScoutReport {
  generatedAt: string;
  dateKey: string;
  proposalCount: number;
  candidatesPerProposal: number;
  proposals: TopProposal[];
  sourceStatus: string;
  clipSourceStatus: string;
  sourceSignals: TrendSignal[];
  workflow: string[];
}
