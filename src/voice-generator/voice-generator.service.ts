import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { mediaConfig } from "../config/media.config";
import { probeDuration } from "../utils/media";
import { assertExecutable, runProcess } from "../utils/process";

export class VoiceGeneratorService {
  async healthCheck(): Promise<void> {
    if (!mediaConfig.piperModelPath) {
      throw new Error(
        "PIPER_MODEL_PATH no está configurado. Indica un modelo de voz .onnx.",
      );
    }
    await assertExecutable(mediaConfig.piperPath, ["--help"]);
  }

  async generate(
    episodeId: number,
    narration: string,
    targetDuration: number,
  ): Promise<string> {
    const directory = path.join(mediaConfig.outputRoot, "audio");
    await mkdir(directory, { recursive: true });
    const rawPath = path.join(directory, `episode-${episodeId}.raw.wav`);
    const outputPath = path.join(directory, `episode-${episodeId}.wav`);

    await runProcess(
      mediaConfig.piperPath,
      [
        "--model",
        mediaConfig.piperModelPath,
        "--output_file",
        rawPath,
      ],
      { input: narration },
    );

    const rawDuration = await probeDuration(rawPath);
    const tempo = rawDuration / targetDuration;
    await runProcess(mediaConfig.ffmpegPath, [
      "-y",
      "-i",
      rawPath,
      "-filter:a",
      this.buildAtempoFilter(tempo),
      "-ar",
      "44100",
      "-ac",
      "1",
      outputPath,
    ]);
    await unlink(rawPath).catch(() => undefined);

    const duration = await probeDuration(outputPath);
    if (duration < 9.9 || duration > 20.1) {
      throw new Error(
        `La narración final dura ${duration.toFixed(2)}s; debe durar 10–20s.`,
      );
    }
    return outputPath;
  }

  private buildAtempoFilter(tempo: number): string {
    const factors: number[] = [];
    let remaining = tempo;
    while (remaining > 2) {
      factors.push(2);
      remaining /= 2;
    }
    while (remaining < 0.5) {
      factors.push(0.5);
      remaining /= 0.5;
    }
    factors.push(remaining);
    return factors.map((factor) => `atempo=${factor.toFixed(6)}`).join(",");
  }
}
