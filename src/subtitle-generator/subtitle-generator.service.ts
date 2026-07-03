import type { Scene } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { mediaConfig } from "../config/media.config";

export interface SubtitleFiles {
  srtPath: string;
  txtPath: string;
}

export class SubtitleGeneratorService {
  async generate(episodeId: number, scenes: Scene[]): Promise<SubtitleFiles> {
    const directory = path.join(mediaConfig.outputRoot, "subtitles");
    await mkdir(directory, { recursive: true });
    const srtPath = path.join(directory, `episode-${episodeId}.srt`);
    const txtPath = path.join(directory, `episode-${episodeId}.txt`);
    let cursor = 0;

    const srtBlocks = scenes.map((scene, index) => {
      const start = cursor;
      cursor += scene.durationSeconds;
      return [
        String(index + 1),
        `${this.timestamp(start)} --> ${this.timestamp(cursor)}`,
        scene.narration,
      ].join("\n");
    });

    await Promise.all([
      writeFile(srtPath, `${srtBlocks.join("\n\n")}\n`, "utf8"),
      writeFile(
        txtPath,
        `${scenes.map((scene) => scene.narration).join("\n")}\n`,
        "utf8",
      ),
    ]);
    return { srtPath, txtPath };
  }

  private timestamp(seconds: number): string {
    const milliseconds = Math.round(seconds * 1000);
    const hours = Math.floor(milliseconds / 3_600_000);
    const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
    const secs = Math.floor((milliseconds % 60_000) / 1000);
    const millis = milliseconds % 1000;
    return `${this.pad(hours)}:${this.pad(minutes)}:${this.pad(secs)},${String(millis).padStart(3, "0")}`;
  }

  private pad(value: number): string {
    return String(value).padStart(2, "0");
  }
}
