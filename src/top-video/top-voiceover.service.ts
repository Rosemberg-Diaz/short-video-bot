import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { mediaConfig } from "../config/media.config";
import { ttsConfig } from "../config/tts.config";
import { probeDuration } from "../utils/media";
import { runProcess } from "../utils/process";
import { slugify } from "../utils/text";
import type { TopClip, TopVideoManifest } from "./top-video.types";

export interface TopVoiceoverSegment {
  rank: number;
  text: string;
  filePath: string;
  startSeconds: number;
  durationSeconds: number;
}

type ResolvedTopClip = TopClip & { absolutePath: string; duration: number };

export class TopVoiceoverService {
  isEnabled(): boolean {
    return ttsConfig.topsVoiceoverEnabled && ttsConfig.provider !== "none";
  }

  async generate(
    manifest: TopVideoManifest,
    clips: ResolvedTopClip[],
    outputDirectory: string,
  ): Promise<TopVoiceoverSegment[]> {
    if (!this.isEnabled()) return [];

    const directory = path.join(
      outputDirectory,
      `voiceover-${slugify(manifest.slug || manifest.title)}`,
    );
    await mkdir(directory, { recursive: true });

    const starts = this.calculateClipStarts(clips);
    const scripts = this.buildScripts(manifest, clips);

    const segments: TopVoiceoverSegment[] = [];
    for (const [index, clip] of clips.entries()) {
      const text = scripts[index]!;
      const filePath = path.join(
        directory,
        `${String(index + 1).padStart(2, "0")}.${this.getAudioExtension()}`,
      );
      await this.synthesize(text, filePath);
      const durationSeconds = await probeDuration(filePath);
      segments.push({
        rank: clip.rank,
        text,
        filePath,
        startSeconds: starts[index]!,
        durationSeconds,
      });
    }

    await writeFile(
      path.join(directory, "script.json"),
      `${JSON.stringify(segments, null, 2)}\n`,
      "utf8",
    );

    return segments;
  }

  private calculateClipStarts(clips: ResolvedTopClip[]): number[] {
    const starts: number[] = [];
    let cursor = 0;
    for (const clip of clips) {
      starts.push(cursor);
      cursor += clip.duration;
    }
    return starts;
  }

  private buildScripts(manifest: TopVideoManifest, clips: ResolvedTopClip[]): string[] {
    const headline = this.cleanSpeechText(
      manifest.title
        .replace(/^top\s*5\s*/iu, "")
        .replace(/^top\s*/iu, "")
        .replace(/#shorts/giu, "")
        .trim(),
    );

    return clips.map((clip, index) => {
      const rankingLine = this.buildRankingLine(clip);
      if (index === 0) {
        return `Hoy rankeamos ${headline}. Numero ${clip.rank}: ${rankingLine}`;
      }
      return `Numero ${clip.rank}: ${rankingLine}`;
    });
  }

  private buildRankingLine(clip: TopClip): string {
    const title = this.compactSpeechTitle(clip.title);
    const lower = title.toLowerCase();
    if (lower.includes("karma")) {
      return "karma instantaneo, sin margen de reaccion.";
    }
    if (lower.includes("arrepent")) {
      return "el arrepentimiento llega antes de que termine el clip.";
    }
    if (lower.includes("mareo") || lower.includes("mare")) {
      return "esto se siente mal incluso antes del final.";
    }
    if (lower.includes("colgada") || lower.includes("colgado")) {
      return "todo parece controlado hasta que deja de estarlo.";
    }
    if (lower.includes("pudo")) {
      return "el intento empieza normal y termina peor de lo esperado.";
    }
    return `${title}. Mira como termina.`;
  }

  private cleanSpeechText(value: string): string {
    return value
      .replace(/#\w+/gu, " ")
      .replace(/\bclick\b.*$/iu, " ")
      .replace(/\bsubscribe\b.*$/iu, " ")
      .replace(/\bsupport my\b.*$/iu, " ")
      .replace(/[^\p{L}\p{N}\s.,:;!?]/gu, " ")
      .replace(/\s+/gu, " ")
      .trim();
  }

  private compactSpeechTitle(value: string): string {
    const title = this.cleanSpeechText(value)
      .replace(/\([^)]*\)/gu, " ")
      .replace(/\s+/gu, " ")
      .trim();
    if (title.length <= 42) return title;
    return title.slice(0, 39).trim();
  }

  private async synthesize(text: string, filePath: string): Promise<void> {
    if (ttsConfig.provider === "elevenlabs") {
      await this.synthesizeWithElevenLabs(text, filePath);
      return;
    }
    if (ttsConfig.provider === "openai") {
      await this.synthesizeWithOpenAi(text, filePath);
      return;
    }
    if (ttsConfig.provider === "piper") {
      await this.synthesizeWithPiper(text, filePath);
      return;
    }
    throw new Error("No hay proveedor TTS configurado.");
  }

  private getAudioExtension(): "mp3" | "wav" {
    return ttsConfig.provider === "piper" ? "wav" : "mp3";
  }

  private async synthesizeWithPiper(text: string, filePath: string): Promise<void> {
    if (!mediaConfig.piperModelPath) {
      throw new Error("Falta PIPER_MODEL_PATH.");
    }

    await runProcess(
      mediaConfig.piperPath,
      ["--model", mediaConfig.piperModelPath, "--output_file", filePath],
      { input: text },
    );
  }

  private async synthesizeWithElevenLabs(
    text: string,
    filePath: string,
  ): Promise<void> {
    if (!ttsConfig.elevenLabsApiKey) {
      throw new Error("Falta ELEVENLABS_API_KEY.");
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ttsConfig.elevenLabsVoiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "xi-api-key": ttsConfig.elevenLabsApiKey,
        },
        body: JSON.stringify({
          text,
          model_id: ttsConfig.elevenLabsModelId,
          voice_settings: {
            stability: ttsConfig.elevenLabsStability,
            similarity_boost: ttsConfig.elevenLabsSimilarityBoost,
            style: ttsConfig.elevenLabsStyle,
            use_speaker_boost: true,
          },
        }),
      },
    );

    await this.writeAudioResponse(response, filePath, "ElevenLabs");
  }

  private async synthesizeWithOpenAi(text: string, filePath: string): Promise<void> {
    if (!ttsConfig.openAiApiKey) {
      throw new Error("Falta OPENAI_API_KEY.");
    }

    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        authorization: `Bearer ${ttsConfig.openAiApiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: ttsConfig.openAiSpeechModel,
        voice: ttsConfig.openAiVoice,
        input: text,
        response_format: "mp3",
        speed: 1.08,
      }),
    });

    await this.writeAudioResponse(response, filePath, "OpenAI");
  }

  private async writeAudioResponse(
    response: Response,
    filePath: string,
    provider: string,
  ): Promise<void> {
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${provider} TTS fallo (${response.status}): ${body}`);
    }

    const audio = Buffer.from(await response.arrayBuffer());
    await writeFile(filePath, audio);
  }
}
