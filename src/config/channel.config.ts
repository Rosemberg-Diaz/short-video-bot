import { getStringArgument } from "../utils/cli";
import type { YouTubeChannelKey } from "./youtube.config";

const YOUTUBE_CHANNELS = ["horror", "viral-tops"] as const;

export function getYouTubeChannelArgument(): YouTubeChannelKey {
  const channel = getStringArgument("channel") ?? "horror";
  if (YOUTUBE_CHANNELS.includes(channel as YouTubeChannelKey)) {
    return channel as YouTubeChannelKey;
  }

  throw new Error(
    `--channel debe ser uno de: ${YOUTUBE_CHANNELS.join(", ")}.`,
  );
}
