import { getYouTubeChannelArgument } from "../config/channel.config";
import { getYouTubeConfig } from "../config/youtube.config";
import { getStringArgument } from "../utils/cli";
import { YouTubeAuthService } from "./youtube-auth.service";

async function main(): Promise<void> {
  const channel = getYouTubeChannelArgument();
  const code = getStringArgument("code");
  await new YouTubeAuthService(getYouTubeConfig(channel)).authorize(code);
  console.log(`YouTube autorizado para ${channel}. Token guardado localmente.`);
}

main().catch((error: unknown) => {
  console.error("No fue posible autorizar YouTube.", error);
  process.exitCode = 1;
});
