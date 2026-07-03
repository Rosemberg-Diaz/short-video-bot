import { prisma } from "../database/client";
import { LocalAssetCleanupService } from "./local-asset-cleanup.service";

function parseEpisodeId(): number {
  const idArgument = process.argv.find((argument) => argument.startsWith("--id="));
  const episodeId = Number(idArgument?.split("=")[1]);
  if (!Number.isInteger(episodeId) || episodeId <= 0) {
    throw new Error("Uso: npm run youtube:cleanup-local -- --id=123");
  }
  return episodeId;
}

async function main(): Promise<void> {
  const episodeId = parseEpisodeId();
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: { scenes: true },
  });

  if (!episode) {
    throw new Error(`No existe el episodio #${episodeId}.`);
  }

  await new LocalAssetCleanupService().cleanupEpisodeAssets(episode);
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
