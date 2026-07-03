import { access } from "node:fs/promises";
import { prisma } from "../database/client";
import { SceneGeneratorService } from "../scene-generator/scene-generator.service";
import { SubtitleGeneratorService } from "../subtitle-generator/subtitle-generator.service";

async function main(): Promise<void> {
  const episode = await prisma.episode.findFirstOrThrow({
    orderBy: { id: "asc" },
    include: { series: true },
  });
  const scenes = await new SceneGeneratorService().generate(episode);
  const subtitleFiles = await new SubtitleGeneratorService().generate(
    episode.id,
    scenes,
  );
  await Promise.all([
    access(subtitleFiles.srtPath),
    access(subtitleFiles.txtPath),
  ]);

  const duration = scenes.reduce(
    (total, scene) => total + scene.durationSeconds,
    0,
  );
  const errors: string[] = [];
  if (scenes.length !== 4) errors.push("No se generaron cuatro escenas.");
  if (duration < 10 || duration > 20) {
    errors.push(`La duración total es ${duration.toFixed(3)}s.`);
  }
  if (scenes.some((scene) => !scene.narration || !scene.imagePrompt)) {
    errors.push("Hay escenas sin narración o prompt.");
  }

  console.log(`Episodio auditado: #${episode.id}`);
  console.log(`Escenas: ${scenes.length}`);
  console.log(`Duración: ${duration.toFixed(3)}s`);
  console.log(`SRT: ${subtitleFiles.srtPath}`);
  console.log(`TXT: ${subtitleFiles.txtPath}`);
  console.log(`Violaciones: ${errors.length}`);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  }
}

main()
  .catch((error: unknown) => {
    console.error("Falló la auditoría del pipeline.", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
