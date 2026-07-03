import type { Episode, Series } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { slugify } from "../utils/text";

type EpisodeWithSeries = Episode & { series: Series };

export class EpisodeExporterService {
  private readonly scriptsDirectory = path.resolve("output", "scripts");
  private readonly metadataDirectory = path.resolve("output", "metadata");

  async export(episode: EpisodeWithSeries): Promise<{
    scriptPath: string;
    metadataPath: string;
  }> {
    await Promise.all([
      mkdir(this.scriptsDirectory, { recursive: true }),
      mkdir(this.metadataDirectory, { recursive: true }),
    ]);

    const baseName = `${String(episode.id).padStart(4, "0")}-${slugify(episode.title)}`;
    const scriptPath = path.join(this.scriptsDirectory, `${baseName}.txt`);
    const metadataPath = path.join(this.metadataDirectory, `${baseName}.txt`);

    const script = [
      `TÍTULO: ${episode.title}`,
      `SERIE: ${episode.series.name}`,
      `FÓRMULA: ${episode.storyFormula}`,
      "",
      `HOOK: ${episode.hook}`,
      "",
      episode.storyBody,
      "",
      `TWIST: ${episode.twistEnding}`,
      "",
      `DURACIÓN ESTIMADA: ${episode.estimatedDurationSeconds} segundos`,
    ].join("\n");

    const metadata = [
      `TÍTULO: ${episode.title}`,
      "",
      `DESCRIPCIÓN:`,
      episode.description,
      "",
      `HASHTAGS:`,
      JSON.parse(episode.hashtags).join(" "),
      "",
      `VIRALIDAD ESTIMADA: ${episode.estimatedViralityScore}/100`,
      `ESTADO: ${episode.status}`,
      `SERIE: ${episode.series.name}`,
      `EPISODIO ID: ${episode.id}`,
    ].join("\n");

    await Promise.all([
      writeFile(scriptPath, `${script}\n`, "utf8"),
      writeFile(metadataPath, `${metadata}\n`, "utf8"),
    ]);

    return { scriptPath, metadataPath };
  }
}
