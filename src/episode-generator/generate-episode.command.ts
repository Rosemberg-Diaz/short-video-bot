import { prisma } from "../database/client";
import { seedSeries } from "../database/seed";
import { getStringArgument } from "../utils/cli";
import { EpisodeGeneratorService } from "./episode-generator.service";

async function main(): Promise<void> {
  await seedSeries();
  const seriesName = getStringArgument("series");
  const episode = await new EpisodeGeneratorService().generate(seriesName);

  console.log(`\nEpisodio #${episode.id} generado`);
  console.log(`Serie: ${episode.series.name}`);
  console.log(`Título: ${episode.title}`);
  console.log(`Hook: ${episode.hook}`);
  console.log(`Duración: ${episode.estimatedDurationSeconds}s`);
  console.log(`Viralidad estimada: ${episode.estimatedViralityScore}/100`);
}

main()
  .catch((error: unknown) => {
    console.error("Error al generar el episodio:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
