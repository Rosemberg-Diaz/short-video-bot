import { google } from "googleapis";
import { getYouTubeChannelArgument } from "../config/channel.config";
import { getYouTubeConfig } from "../config/youtube.config";
import { prisma } from "../database/client";
import { getStringArgument } from "../utils/cli";
import { getPrivacyArgument } from "./youtube-cli";
import { YouTubeAuthService } from "./youtube-auth.service";

async function main(): Promise<void> {
  const channel = getYouTubeChannelArgument();
  const youtubeConfig = getYouTubeConfig(channel);
  const rawId = getStringArgument("id");
  const id = rawId ? Number(rawId) : undefined;
  if (rawId && (!Number.isSafeInteger(id) || id! <= 0)) {
    throw new Error("--id debe ser un entero positivo.");
  }

  const videoId = getStringArgument("videoId");
  const privacyStatus = getPrivacyArgument(youtubeConfig.defaultPrivacyStatus);

  const episode = id
    ? await prisma.episode.findUnique({ where: { id } })
    : videoId
      ? null
      : await prisma.episode.findFirst({
          where: { youtubeVideoId: { not: null } },
          orderBy: { uploadedAt: "desc" },
        });

  const targetVideoId = videoId || episode?.youtubeVideoId;
  if (!targetVideoId) {
    throw new Error("Debes pasar --id de episodio subido o --videoId.");
  }

  const auth = await new YouTubeAuthService(youtubeConfig).getAuthorizedClient();
  const youtube = google.youtube({ version: "v3", auth });

  console.log(`Actualizando ${targetVideoId} en ${channel} a ${privacyStatus}...`);
  await youtube.videos.update({
    part: ["status"],
    requestBody: {
      id: targetVideoId,
      status: {
        privacyStatus,
        selfDeclaredMadeForKids: false,
        containsSyntheticMedia: true,
      },
    },
  });

  if (episode) {
    await prisma.episode.update({
      where: { id: episode.id },
      data: { youtubePrivacyStatus: privacyStatus },
    });
  }

  console.log(`Privacidad actualizada: https://www.youtube.com/watch?v=${targetVideoId}`);
}

main()
  .catch((error: unknown) => {
    console.error("No fue posible actualizar la privacidad en YouTube.", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
