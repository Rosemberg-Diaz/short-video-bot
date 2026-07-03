import "dotenv/config";
import path from "node:path";

export type YouTubePrivacyStatus = "private" | "unlisted" | "public";
export type YouTubeChannelKey = "horror" | "viral-tops";

export interface YouTubeConfig {
  channel: YouTubeChannelKey;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenPath: string;
  defaultPrivacyStatus: YouTubePrivacyStatus;
  defaultCategoryId: string;
  notifySubscribers: boolean;
  cleanupLocalAssetsAfterUpload: boolean;
}

function privacyStatusFromEnv(value?: string): YouTubePrivacyStatus {
  if (value === "public" || value === "unlisted" || value === "private") {
    return value;
  }
  return "private";
}

const CHANNEL_ENV_PREFIX: Record<YouTubeChannelKey, string> = {
  horror: "YOUTUBE",
  "viral-tops": "YOUTUBE_VIRAL_TOPS",
};

const DEFAULT_TOKEN_PATH: Record<YouTubeChannelKey, string> = {
  horror: "output/youtube/horror-oauth-token.json",
  "viral-tops": "output/youtube/viral-tops-oauth-token.json",
};

function readChannelEnv(
  channel: YouTubeChannelKey,
  name: string,
): string | undefined {
  const channelValue = process.env[`${CHANNEL_ENV_PREFIX[channel]}_${name}`];
  if (channel === "horror") {
    return channelValue || process.env[`YOUTUBE_${name}`];
  }
  return channelValue;
}

export function getYouTubeConfig(channel: YouTubeChannelKey = "horror"): YouTubeConfig {
  return {
    channel,
    clientId: readChannelEnv(channel, "CLIENT_ID") || "",
    clientSecret: readChannelEnv(channel, "CLIENT_SECRET") || "",
    redirectUri:
      readChannelEnv(channel, "REDIRECT_URI") ||
      "http://127.0.0.1:53682/oauth2callback",
    tokenPath: path.resolve(
      readChannelEnv(channel, "TOKEN_PATH") || DEFAULT_TOKEN_PATH[channel],
    ),
    defaultPrivacyStatus: privacyStatusFromEnv(
      readChannelEnv(channel, "PRIVACY_STATUS"),
    ),
    defaultCategoryId: readChannelEnv(channel, "CATEGORY_ID") || "24",
    notifySubscribers: readChannelEnv(channel, "NOTIFY_SUBSCRIBERS") === "true",
    cleanupLocalAssetsAfterUpload:
      readChannelEnv(channel, "CLEANUP_LOCAL_ASSETS_AFTER_UPLOAD") !== "false",
  };
}

export const youtubeConfig = getYouTubeConfig();
