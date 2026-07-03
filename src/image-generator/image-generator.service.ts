import type { Scene } from "@prisma/client";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { mediaConfig } from "../config/media.config";
import { prisma } from "../database/client";
import type { ImageGenerationProvider } from "./image-generation.provider";
import { LocalStableDiffusionProvider } from "./local-stable-diffusion.provider";

export class ImageGeneratorService {
  constructor(
    private readonly provider: ImageGenerationProvider =
      new LocalStableDiffusionProvider(),
  ) {}

  async generateForScenes(episodeId: number, scenes: Scene[]): Promise<Scene[]> {
    await this.provider.healthCheck();
    const directory = path.join(
      mediaConfig.outputRoot,
      "images",
      String(episodeId),
    );
    await mkdir(directory, { recursive: true });

    for (const scene of scenes) {
      const outputPath = path.join(
        directory,
        `scene-${scene.sceneNumber}.png`,
      );
      if (!(await this.exists(outputPath))) {
        await this.provider.generate({
          prompt: scene.imagePrompt,
          width: mediaConfig.imageWidth,
          height: mediaConfig.imageHeight,
          outputPath,
        });
      }
      await prisma.scene.update({
        where: { id: scene.id },
        data: { imagePath: outputPath },
      });
    }

    return prisma.scene.findMany({
      where: { episodeId },
      orderBy: { sceneNumber: "asc" },
    });
  }

  private async exists(filePath: string): Promise<boolean> {
    return access(filePath).then(() => true).catch(() => false);
  }
}
