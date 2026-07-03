export interface TopClip {
  rank: number;
  file: string;
  title: string;
  creator?: string;
  sourceUrl?: string;
  startSeconds?: number;
  durationSeconds?: number;
}

export interface TopVideoManifest {
  title: string;
  slug: string;
  description?: string;
  voiceoverStyle?: string;
  clips: TopClip[];
  hashtags?: string[];
}

export interface TopBuildResult {
  videoPath: string;
  metadataPath: string;
}
