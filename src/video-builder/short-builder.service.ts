import type { Episode, Scene, Series } from "@prisma/client";
import { RENDER_STATUS } from "../config/constants";
import { prisma } from "../database/client";
import { ImageGeneratorService } from "../image-generator/image-generator.service";
import { LocalStableDiffusionProvider } from "../image-generator/local-stable-diffusion.provider";
import { SceneGeneratorService } from "../scene-generator/scene-generator.service";
import { SubtitleGeneratorService } from "../subtitle-generator/subtitle-generator.service";
import { VoiceGeneratorService } from "../voice-generator/voice-generator.service";
import { VideoBuilderService } from "./video-builder.service";

type RenderableEpisode = Episode & { series: Series; scenes?: Scene[] };

export class ShortBuilderService {
  private readonly imageProvider = new LocalStableDiffusionProvider();
  private readonly sceneGenerator = new SceneGeneratorService();
  private readonly imageGenerator = new ImageGeneratorService(this.imageProvider);
  private readonly voiceGenerator = new VoiceGeneratorService();
  private readonly subtitleGenerator = new SubtitleGeneratorService();
  private readonly videoBuilder = new VideoBuilderService();

  async healthCheck(): Promise<void> {
    await Promise.all([
      this.videoBuilder.healthCheck(),
      this.voiceGenerator.healthCheck(),
      this.imageProvider.healthCheck(),
    ]);
  }

  async build(episode: RenderableEpisode): Promise<Episode> {
    try {
      await this.healthCheck();
      await this.updateStatus(episode.id, RENDER_STATUS.PENDING);
      let scenes = await this.sceneGenerator.generate(episode);
      await this.updateStatus(episode.id, RENDER_STATUS.SCENES_READY);

      scenes = await this.imageGenerator.generateForScenes(episode.id, scenes);
      await this.updateStatus(episode.id, RENDER_STATUS.IMAGES_READY);

      const narration = scenes.map((scene) => scene.narration).join(" ");
      const targetDuration = scenes.reduce(
        (total, scene) => total + scene.durationSeconds,
        0,
      );
      const audioPath = await this.voiceGenerator.generate(
        episode.id,
        narration,
        targetDuration,
      );
      await prisma.episode.update({
        where: { id: episode.id },
        data: { audioPath, renderStatus: RENDER_STATUS.AUDIO_READY },
      });

      const subtitleFiles = await this.subtitleGenerator.generate(
        episode.id,
        scenes,
      );
      await prisma.episode.update({
        where: { id: episode.id },
        data: {
          subtitlePath: subtitleFiles.srtPath,
          renderStatus: RENDER_STATUS.SUBTITLES_READY,
        },
      });

      await this.updateStatus(episode.id, RENDER_STATUS.RENDERING);
      const videoPath = await this.videoBuilder.build(
        episode.id,
        scenes,
        audioPath,
        subtitleFiles.srtPath,
      );
      return prisma.episode.update({
        where: { id: episode.id },
        data: {
          videoPath,
          audioPath,
          subtitlePath: subtitleFiles.srtPath,
          renderStatus: RENDER_STATUS.COMPLETED,
          renderError: null,
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.episode.update({
        where: { id: episode.id },
        data: {
          renderStatus: RENDER_STATUS.FAILED,
          renderError: message.slice(0, 4000),
        },
      });
      throw error;
    }
  }

  private async updateStatus(episodeId: number, renderStatus: string) {
    await prisma.episode.update({
      where: { id: episodeId },
      data: { renderStatus, renderError: null },
    });
  }
}
