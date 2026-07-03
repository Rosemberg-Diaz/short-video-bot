import type { YouTubePrivacyStatus } from "../config/youtube.config";
import { getStringArgument } from "../utils/cli";

export function getPrivacyArgument(
  fallback: YouTubePrivacyStatus,
): YouTubePrivacyStatus {
  const value = getStringArgument("privacy") || fallback;
  if (value === "private" || value === "unlisted" || value === "public") {
    return value;
  }
  throw new Error("--privacy debe ser private, unlisted o public.");
}
