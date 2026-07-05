import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { mediaConfig } from "../config/media.config";
import { probeDuration } from "../utils/media";
import { assertExecutable, runProcess } from "../utils/process";
import { slugify } from "../utils/text";
import type { TopBuildResult, TopClip, TopVideoManifest } from "./top-video.types";
import {
  TopVoiceoverService,
  type TopVoiceoverSegment,
} from "./top-voiceover.service";

const DEFAULT_CLIP_DURATION_SECONDS = 6;
const MAX_TOP_DURATION_SECONDS = 60;

export class TopVideoBuilderService {
  private readonly voiceoverService = new TopVoiceoverService();

  async healthCheck(): Promise<void> {
    await assertExecutable(mediaConfig.ffmpegPath);
    try {
      await assertExecutable(mediaConfig.ffprobePath);
    } catch {
      // ffmpeg can still report media duration when ffprobe is unavailable.
    }
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
    const voiceoverSegments = await this.voiceoverService.generate(
      manifest,
      clips,
      outputDirectory,
    );

    await runProcess(mediaConfig.ffmpegPath, [
      "-y",
      ...clips.flatMap((clip) => ["-i", clip.absolutePath]),
      ...voiceoverSegments.flatMap((segment) => ["-i", segment.filePath]),
      "-filter_complex",
      this.buildFilter(clips, manifest.title, voiceoverSegments),
      "-map",
      "[video]",
      "-map",
      "[audio]",
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
          output: {
            videoPath,
            durationSeconds: Number(duration.toFixed(2)),
            voiceoverSegments,
          },
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
    title: string,
    voiceoverSegments: TopVoiceoverSegment[],
  ): string {
    const headline = this.escapeDrawText(this.getRankingHeadline(title));
    const fontFile = this.escapeFontFilePath(this.getBoldFontFile());
    const normalized = clips.map((clip, index) => {
      const start = clip.startSeconds ?? 0;
      const rankingList = this.buildRankingListOverlay(clips, clip.rank, fontFile);

      return (
        `[${index}:v]trim=start=${start}:duration=${clip.duration},` +
        "setpts=PTS-STARTPTS," +
        "scale=1080:1920:force_original_aspect_ratio=increase," +
        "crop=1080:1920,setsar=1,fps=30,format=yuv420p," +
        "drawbox=x=0:y=0:w=1080:h=250:color=black@0.20:t=fill," +
        `drawtext=fontfile='${fontFile}':text='RANKING':x=(w-text_w)/2:y=70:fontsize=74:fontcolor=yellow:borderw=7:bordercolor=black,` +
        `drawtext=fontfile='${fontFile}':text='${headline}':x=(w-text_w)/2:y=155:fontsize=68:fontcolor=white:borderw=7:bordercolor=black` +
        `${rankingList},` +
        `drawtext=fontfile='${fontFile}':text='TOP VIRAL':x=(w-text_w)/2:y=h-115:fontsize=30:fontcolor=white:borderw=4:bordercolor=black[v${index}];` +
        `[${index}:a]atrim=start=${start}:duration=${clip.duration},` +
        "asetpts=PTS-STARTPTS,aresample=44100," +
        `aformat=sample_fmts=fltp:channel_layouts=stereo[a${index}]`
      );
    });
    const concatInputs = clips.map((_, index) => `[v${index}][a${index}]`).join("");
    return [
      ...normalized,
      `${concatInputs}concat=n=${clips.length}:v=1:a=1[video][clipaudio]`,
      this.buildAudioMixFilter(clips, voiceoverSegments),
    ].join(";");
  }

  private buildAudioMixFilter(
    clips: Array<TopClip & { absolutePath: string; duration: number }>,
    voiceoverSegments: TopVoiceoverSegment[],
  ): string {
    if (voiceoverSegments.length === 0) {
      return "[clipaudio]anull[audio]";
    }

    const voiceFilters = voiceoverSegments.map((segment, index) => {
      const inputIndex = clips.length + index;
      const delayMs = Math.max(0, Math.round(segment.startSeconds * 1000));
      return (
        `[${inputIndex}:a]aresample=44100,` +
        "aformat=sample_fmts=fltp:channel_layouts=stereo," +
        "volume=1.18," +
        `adelay=${delayMs}|${delayMs}[voice${index}]`
      );
    });
    const voiceInputs = voiceoverSegments.map((_, index) => `[voice${index}]`).join("");

    return [
      ...voiceFilters,
      `${voiceInputs}amix=inputs=${voiceoverSegments.length}:duration=longest:dropout_transition=0[voicemix]`,
      "[clipaudio]volume=0.92[baseaudio]",
      "[baseaudio][voicemix]sidechaincompress=threshold=0.035:ratio=9:attack=18:release=360[ducked]",
      "[ducked][voicemix]amix=inputs=2:duration=first:dropout_transition=0[audio]",
    ].join(";");
  }

  private escapeDrawText(value: string): string {
    return value
      .replace(/\\/gu, "\\\\")
      .replace(/:/gu, "\\:")
      .replace(/'/gu, "\\'")
      .replace(/\[/gu, "\\[")
      .replace(/\]/gu, "\\]");
  }

  private buildRankingListOverlay(
    clips: Array<TopClip & { absolutePath: string; duration: number }>,
    currentRank: number,
    fontFile: string,
  ): string {
    return clips
      .map((clip, index) => {
        const y = 815 + index * 78;
        const label =
          clip.rank <= currentRank ? this.escapeDrawText(this.compactRankingTitle(clip)) : "";
        const textOverlay = label
          ? `,drawtext=fontfile='${fontFile}':text='${label}':x=116:y=${y}:fontsize=42:fontcolor=white:borderw=5:bordercolor=black`
          : "";
        return (
          `,drawtext=fontfile='${fontFile}':text='${clip.rank}.':x=54:y=${y}:fontsize=42:fontcolor=yellow:borderw=4:bordercolor=black` +
          textOverlay
        );
      })
      .join("");
  }

  private compactRankingTitle(clip: TopClip): string {
    const title = clip.title
      .replace(/[^\p{L}\p{N}\s?]/gu, "")
      .replace(/\s+/gu, " ")
      .trim();
    if (title.length <= 24) return title;
    return `${title.slice(0, 21).trim()}...`;
  }

  private getRankingHeadline(title: string): string {
    const headline = title
      .replace(/^top\s*5\s*/iu, "")
      .replace(/^top\s*/iu, "")
      .replace(/#shorts/giu, "")
      .replace(/\s+que\s+parecen\s+irreales.*$/iu, "")
      .replace(/^cosas\s+/iu, "")
      .trim()
      .toUpperCase();

    if (headline.length <= 24) return headline;
    return `${headline.slice(0, 21).trim()}...`;
  }

  private getBoldFontFile(): string {
    return "C:/Windows/Fonts/arialbd.ttf";
  }

  private escapeFontFilePath(value: string): string {
    return value.replace(/:/gu, "\\:");
  }
}
