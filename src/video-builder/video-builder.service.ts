import type { Scene } from "@prisma/client";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { mediaConfig } from "../config/media.config";
import { probeDuration } from "../utils/media";
import { assertExecutable, runProcess } from "../utils/process";

export class VideoBuilderService {
  async healthCheck(): Promise<void> {
    await Promise.all([
      assertExecutable(mediaConfig.ffmpegPath),
      assertExecutable(mediaConfig.ffprobePath),
    ]);
  }

  async build(
    episodeId: number,
    scenes: Scene[],
    audioPath: string,
    subtitlePath: string,
  ): Promise<string> {
    if (scenes.length !== 4 || scenes.some((scene) => !scene.imagePath)) {
      throw new Error("Se requieren exactamente cuatro escenas con imagen.");
    }

    const directory = path.join(mediaConfig.outputRoot, "videos");
    await mkdir(directory, { recursive: true });
    const outputPath = path.join(directory, `episode-${episodeId}.mp4`);
    const inputArgs = scenes.flatMap((scene, index) => [
      "-loop",
      "1",
      "-t",
      String(
        scene.durationSeconds +
          (index < scenes.length - 1 ? mediaConfig.transitionSeconds : 0),
      ),
      "-i",
      scene.imagePath!,
    ]);
    inputArgs.push("-i", audioPath);

    await runProcess(mediaConfig.ffmpegPath, [
      "-y",
      ...inputArgs,
      "-filter_complex",
      this.buildFilter(scenes, subtitlePath),
      "-map",
      "[video]",
      "-map",
      "4:a:0",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      "-shortest",
      outputPath,
    ]);

    const duration = await probeDuration(outputPath);
    if (duration < 9.9 || duration > 20.1) {
      throw new Error(
        `El video dura ${duration.toFixed(2)}s; debe durar entre 10 y 20s.`,
      );
    }
    return outputPath;
  }

  private buildFilter(scenes: Scene[], subtitlePath: string): string {
    const fps = mediaConfig.fps;
    const transition = mediaConfig.transitionSeconds;
    const sceneFilters = scenes.map((scene, index) => {
      const clipDuration =
        scene.durationSeconds + (index < scenes.length - 1 ? transition : 0);
      const frames = Math.ceil(clipDuration * fps);
      const horizontalMotion = index % 2 === 0 ? "sin(on/30)*8" : "cos(on/30)*8";
      return (
        `[${index}:v]scale=1200:2134:force_original_aspect_ratio=increase,` +
        `crop=1080:1920,zoompan=` +
        `z='min(zoom+0.0008,1.08)':` +
        `x='iw/2-(iw/zoom/2)+${horizontalMotion}':` +
        `y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=${fps},` +
        `setsar=1,format=yuv420p[v${index}]`
      );
    });

    const offset1 = scenes[0]!.durationSeconds;
    const offset2 = offset1 + scenes[1]!.durationSeconds;
    const offset3 = offset2 + scenes[2]!.durationSeconds;
    const escapedSubtitles = subtitlePath
      .replace(/\\/gu, "/")
      .replace(/:/gu, "\\:")
      .replace(/'/gu, "\\'");
    const transitions = [
      `[v0][v1]xfade=transition=fade:duration=${transition}:offset=${offset1}[x1]`,
      `[x1][v2]xfade=transition=fadeblack:duration=${transition}:offset=${offset2}[x2]`,
      `[x2][v3]xfade=transition=fade:duration=${transition}:offset=${offset3}[x3]`,
      `[x3]subtitles='${escapedSubtitles}':force_style='Alignment=2,FontSize=22,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=3,Shadow=1,MarginV=90'[video]`,
    ];
    return [...sceneFilters, ...transitions].join(";");
  }
}
