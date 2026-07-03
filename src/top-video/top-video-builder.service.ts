import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { mediaConfig } from "../config/media.config";
import { probeDuration } from "../utils/media";
import { assertExecutable, runProcess } from "../utils/process";
import { slugify } from "../utils/text";
import type { TopBuildResult, TopClip, TopVideoManifest } from "./top-video.types";

const DEFAULT_CLIP_DURATION_SECONDS = 6;
const MAX_TOP_DURATION_SECONDS = 60;

export class TopVideoBuilderService {
  async healthCheck(): Promise<void> {
    await Promise.all([
      assertExecutable(mediaConfig.ffmpegPath),
      assertExecutable(mediaConfig.ffprobePath),
    ]);
  }

  async loadManifest(manifestPath: string): Promise<TopVideoManifest> {
    const raw = await readFile(manifestPath, "utf8");
    const manifest = JSON.parse(raw) as TopVideoManifest;
    this.validateManifest(manifest);
    return manifest;
  }

  async build(manifestPath: string): Promise<TopBuildResult> {
    await this.healthCheck();
    const manifest = await this.loadManifest(manifestPath);
    const manifestDirectory = path.dirname(path.resolve(manifestPath));
    const outputDirectory = path.join(mediaConfig.outputRoot, "tops");
    await mkdir(outputDirectory, { recursive: true });

    const slug = slugify(manifest.slug || manifest.title);
    const videoPath = path.join(outputDirectory, `${slug}.mp4`);
    const metadataPath = path.join(outputDirectory, `${slug}.metadata.json`);
    const clips = await this.resolveClips(manifest, manifestDirectory);

    await runProcess(mediaConfig.ffmpegPath, [
      "-y",
      ...clips.flatMap((clip) => ["-i", clip.absolutePath]),
      "-f",
      "lavfi",
      "-i",
      "anullsrc=channel_layout=stereo:sample_rate=44100",
      "-filter_complex",
      this.buildFilter(clips),
      "-map",
      "[video]",
      "-map",
      `${clips.length}:a`,
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
      "128k",
      "-shortest",
      "-movflags",
      "+faststart",
      videoPath,
    ]);

    const duration = await probeDuration(videoPath);
    await writeFile(
      metadataPath,
      `${JSON.stringify(
        {
          ...manifest,
          output: { videoPath, durationSeconds: Number(duration.toFixed(2)) },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    return { videoPath, metadataPath };
  }

  private validateManifest(manifest: TopVideoManifest): void {
    if (!manifest.title?.trim()) {
      throw new Error("El manifest necesita title.");
    }
    if (!manifest.slug?.trim()) {
      throw new Error("El manifest necesita slug.");
    }
    if (!Array.isArray(manifest.clips) || manifest.clips.length !== 5) {
      throw new Error("El top debe tener exactamente 5 clips.");
    }

    const ranks = new Set(manifest.clips.map((clip) => clip.rank));
    for (const rank of [1, 2, 3, 4, 5]) {
      if (!ranks.has(rank)) {
        throw new Error(`Falta el clip rank ${rank}.`);
      }
    }
  }

  private async resolveClips(
    manifest: TopVideoManifest,
    manifestDirectory: string,
  ): Promise<Array<TopClip & { absolutePath: string; duration: number }>> {
    const sorted = [...manifest.clips].sort((left, right) => left.rank - right.rank);
    const resolved = await Promise.all(
      sorted.map(async (clip) => {
        const absolutePath = path.resolve(manifestDirectory, clip.file);
        if (!existsSync(absolutePath)) {
          throw new Error(`No existe el clip #${clip.rank}: ${absolutePath}`);
        }
        const sourceDuration = await probeDuration(absolutePath);
        const requestedDuration =
          clip.durationSeconds ?? Math.min(DEFAULT_CLIP_DURATION_SECONDS, sourceDuration);
        const availableDuration = Math.max(
          0.1,
          sourceDuration - (clip.startSeconds ?? 0),
        );
        const duration = Math.min(requestedDuration, availableDuration);
        return { ...clip, absolutePath, duration };
      }),
    );

    const totalDuration = resolved.reduce((total, clip) => total + clip.duration, 0);
    if (totalDuration > MAX_TOP_DURATION_SECONDS) {
      throw new Error(
        `El top dura ${totalDuration.toFixed(1)}s; el maximo inicial es ${MAX_TOP_DURATION_SECONDS}s.`,
      );
    }
    return resolved;
  }

  private buildFilter(
    clips: Array<TopClip & { absolutePath: string; duration: number }>,
  ): string {
    const normalized = clips.map((clip, index) => {
      const start = clip.startSeconds ?? 0;
      const title = this.escapeDrawText(`#${clip.rank} ${clip.title}`);
      const credit = this.escapeDrawText(clip.creator ? `credit: ${clip.creator}` : "");
      const drawCredit = credit
        ? `,drawtext=text='${credit}':x=44:y=h-132:fontsize=34:fontcolor=white:borderw=3:bordercolor=black@0.75`
        : "";

      return (
        `[${index}:v]trim=start=${start}:duration=${clip.duration},` +
        "setpts=PTS-STARTPTS," +
        "scale=1080:1920:force_original_aspect_ratio=increase," +
        "crop=1080:1920,setsar=1,fps=30,format=yuv420p," +
        "drawbox=x=0:y=0:w=1080:h=220:color=black@0.45:t=fill," +
        `drawtext=text='${title}':x=44:y=70:fontsize=56:fontcolor=white:borderw=4:bordercolor=black@0.8` +
        `${drawCredit}[v${index}]`
      );
    });
    const concatInputs = clips.map((_, index) => `[v${index}]`).join("");
    return [...normalized, `${concatInputs}concat=n=${clips.length}:v=1:a=0[video]`].join(";");
  }

  private escapeDrawText(value: string): string {
    return value
      .replace(/\\/gu, "\\\\")
      .replace(/:/gu, "\\:")
      .replace(/'/gu, "\\'")
      .replace(/\[/gu, "\\[")
      .replace(/\]/gu, "\\]");
  }
}
