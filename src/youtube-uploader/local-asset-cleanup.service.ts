import fs from "node:fs/promises";
import path from "node:path";
import type { Episode, Scene } from "@prisma/client";
import { prisma } from "../database/client";

type EpisodeWithScenes = Episode & { scenes?: Scene[] };

export class LocalAssetCleanupService {
  private readonly outputRoot = path.resolve("output");

  async cleanupEpisodeAssets(episode: EpisodeWithScenes): Promise<void> {
    const paths = await this.collectPaths(episode);
    const deleted: string[] = [];

    try {
      for (const filePath of paths) {
        await this.removeFileIfSafe(filePath);
        deleted.push(filePath);
      }

      await this.removeSceneDirectoriesIfEmpty(episode.id);

      await prisma.episode.update({
        where: { id: episode.id },
        data: {
          localAssetsCleanedAt: new Date(),
          localCleanupError: null,
        },
      });

      if (deleted.length > 0) {
        console.log(`Assets locales limpiados: ${deleted.length} archivos.`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.episode.update({
        where: { id: episode.id },
        data: { localCleanupError: message.slice(0, 4000) },
      });
      throw error;
    }
  }

  private async collectPaths(episode: EpisodeWithScenes): Promise<string[]> {
    const scenes =
      episode.scenes ??
      (await prisma.scene.findMany({ where: { episodeId: episode.id } }));
    const rawPaths = [
      episode.videoPath,
      episode.audioPath,
      episode.subtitlePath,
      episode.subtitlePath?.replace(/\.srt$/iu, ".txt"),
      ...scenes.map((scene) => scene.imagePath),
    ];

    return [...new Set(rawPaths.filter((value): value is string => Boolean(value)))];
  }

  private async removeFileIfSafe(filePath: string): Promise<void> {
    const resolvedPath = path.resolve(filePath);
    if (!this.isInsideOutput(resolvedPath)) {
      throw new Error(`Ruta fuera de output, limpieza bloqueada: ${resolvedPath}`);
    }

    await fs.rm(resolvedPath, { force: true });
  }

  private async removeSceneDirectoriesIfEmpty(episodeId: number): Promise<void> {
    const imagesDirectory = path.resolve("output", "images", String(episodeId));
    if (!this.isInsideOutput(imagesDirectory)) return;

    try {
      await fs.rmdir(imagesDirectory);
    } catch {
      // Si no existe o no esta vacio, no pasa nada.
    }
  }

  private isInsideOutput(resolvedPath: string): boolean {
    return (
      resolvedPath === this.outputRoot ||
      resolvedPath.startsWith(`${this.outputRoot}${path.sep}`)
    );
  }
}
