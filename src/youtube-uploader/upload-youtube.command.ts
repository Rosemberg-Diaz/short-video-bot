import { RENDER_STATUS, YOUTUBE_UPLOAD_STATUS } from "../config/constants";
import { getYouTubeChannelArgument } from "../config/channel.config";
import { getYouTubeConfig } from "../config/youtube.config";
import { prisma } from "../database/client";
import { getStringArgument } from "../utils/cli";
import { getPrivacyArgument } from "./youtube-cli";
import { YouTubeUploaderService } from "./youtube-uploader.service";

async function main(): Promise<void> {
  const channel = getYouTubeChannelArgument();
  const youtubeConfig = getYouTubeConfig(channel);
  const rawId = getStringArgument("id");
  const id = rawId ? Number(rawId) : undefined;
  if (rawId && (!Number.isSafeInteger(id) || id! <= 0)) {
    throw new Error("--id debe ser un entero positivo.");
  }

  const privacyStatus = getPrivacyArgument(youtubeConfig.defaultPrivacyStatus);
  const episode = await prisma.episode.findFirst({
    where: id
      ? { id }
      : {
          renderStatus: RENDER_STATUS.COMPLETED,
          youtubeUploadStatus: { not: YOUTUBE_UPLOAD_STATUS.COMPLETED },
        },
    orderBy: { createdAt: "desc" },
  });

  if (!episode) {
    throw new Error(
      id
        ? `No existe el episodio #${id}.`
        : "No hay episodios renderizados pendientes por subir.",
    );
  }

  console.log(
    `Subiendo episodio #${episode.id} a YouTube (${channel}) como ${privacyStatus}: ${episode.title}`,
  );
  const uploaded = await new YouTubeUploaderService(youtubeConfig).uploadEpisode(
    episode,
    privacyStatus,
  );
  console.log(`YouTube listo: ${uploaded.youtubeUrl}`);
}

main()
  .catch((error: unknown) => {
    console.error("No fue posible subir el Short a YouTube.", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
