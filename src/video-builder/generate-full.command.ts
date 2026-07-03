import { prisma } from "../database/client";
import { seedSeries } from "../database/seed";
import { EpisodeGeneratorService } from "../episode-generator/episode-generator.service";
import {
  getPositiveIntegerArgument,
  getStringArgument,
} from "../utils/cli";
import { ShortBuilderService } from "./short-builder.service";

async function main(): Promise<void> {
  const count = getPositiveIntegerArgument("count", 20);
  const seriesName = getStringArgument("series");
  const builder = new ShortBuilderService();

  await builder.healthCheck();
  await seedSeries();
  const episodeGenerator = new EpisodeGeneratorService();
  const completed: number[] = [];

  for (let index = 0; index < count; index += 1) {
    const episode = await episodeGenerator.generate(seriesName);
    console.log(`[${index + 1}/${count}] Generado #${episode.id}: ${episode.title}`);
    const result = await builder.build(episode);
    completed.push(result.id);
    console.log(`[${index + 1}/${count}] Video: ${result.videoPath}`);
  }

  console.log(`Pipeline completado: ${completed.length} Shorts.`);
}

main()
  .catch((error: unknown) => {
    console.error("El pipeline completo se detuvo.", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
