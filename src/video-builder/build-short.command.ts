import { prisma } from "../database/client";
import { getStringArgument } from "../utils/cli";
import { ShortBuilderService } from "./short-builder.service";

async function main(): Promise<void> {
  const rawId = getStringArgument("id");
  const id = rawId ? Number(rawId) : undefined;
  if (rawId && (!Number.isSafeInteger(id) || id! <= 0)) {
    throw new Error("--id debe ser un entero positivo.");
  }

  const episode = await prisma.episode.findFirst({
    where: id ? { id } : { renderStatus: { not: "COMPLETED" } },
    orderBy: { createdAt: "desc" },
    include: { series: true, scenes: true },
  });
  if (!episode) {
    throw new Error(
      id
        ? `No existe el episodio #${id}.`
        : "No hay episodios pendientes de render.",
    );
  }

  const builder = new ShortBuilderService();
  console.log(`Renderizando episodio #${episode.id}: ${episode.title}`);
  const result = await builder.build(episode);
  console.log(`Short completado: ${result.videoPath}`);
}

main()
  .catch((error: unknown) => {
    console.error("No fue posible construir el Short.", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
