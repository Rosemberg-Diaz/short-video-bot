import { prisma } from "../database/client";
import { seedSeries } from "../database/seed";
import {
  getPositiveIntegerArgument,
  getStringArgument,
} from "../utils/cli";
import { EpisodeGeneratorService } from "./episode-generator.service";

async function main(): Promise<void> {
  const count = getPositiveIntegerArgument("count", 100);
  const seriesName = getStringArgument("series");
  await seedSeries();

  const generator = new EpisodeGeneratorService();
  const generatedIds: number[] = [];

  for (let index = 0; index < count; index += 1) {
    const episode = await generator.generate(seriesName);
    generatedIds.push(episode.id);
    console.log(
      `[${index + 1}/${count}] #${episode.id} ${episode.title} — ${episode.series.name}`,
    );
  }

  console.log(
    `\nLote completado: ${generatedIds.length} episodios (${generatedIds[0]}–${generatedIds.at(-1)}).`,
  );
}

main()
  .catch((error: unknown) => {
    console.error("Error al generar el lote:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
