import { getYouTubeChannelArgument } from "../config/channel.config";
import { getYouTubeConfig } from "../config/youtube.config";
import { prisma } from "../database/client";
import { seedSeries } from "../database/seed";
import { EpisodeGeneratorService } from "../episode-generator/episode-generator.service";
import {
  getPositiveIntegerArgument,
  getStringArgument,
} from "../utils/cli";
import { ShortBuilderService } from "../video-builder/short-builder.service";
import { getPrivacyArgument } from "./youtube-cli";
import { YouTubeUploaderService } from "./youtube-uploader.service";

async function main(): Promise<void> {
  const channel = getYouTubeChannelArgument();
  const youtubeConfig = getYouTubeConfig(channel);
  const count = getPositiveIntegerArgument("count", 1);
  const seriesName = getStringArgument("series");
  const privacyStatus = getPrivacyArgument(youtubeConfig.defaultPrivacyStatus);
  const builder = new ShortBuilderService();
  const uploader = new YouTubeUploaderService(youtubeConfig);

  await builder.healthCheck();
  await seedSeries();

  const episodeGenerator = new EpisodeGeneratorService();
  const uploadedUrls: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const episode = await episodeGenerator.generate(seriesName);
    console.log(`[${index + 1}/${count}] Guion #${episode.id}: ${episode.title}`);

    const rendered = await builder.build(episode);
    console.log(`[${index + 1}/${count}] Video: ${rendered.videoPath}`);

    const uploaded = await uploader.uploadEpisode(rendered, privacyStatus);
    uploadedUrls.push(uploaded.youtubeUrl || "");
    console.log(`[${index + 1}/${count}] YouTube (${channel}): ${uploaded.youtubeUrl}`);
  }

  console.log(`Pipeline publicado: ${uploadedUrls.length} Shorts.`);
}

main()
  .catch((error: unknown) => {
    console.error("El pipeline generar/renderizar/subir se detuvo.", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
