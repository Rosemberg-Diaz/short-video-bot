import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { mediaConfig } from "../config/media.config";
import { runProcess } from "../utils/process";
import type {
  ImageGenerationProvider,
  ImageGenerationRequest,
} from "./image-generation.provider";

interface StableDiffusionResponse {
  images?: string[];
  detail?: string;
}

export class LocalStableDiffusionProvider
  implements ImageGenerationProvider
{
  readonly name = "local-stable-diffusion";

  constructor(private readonly baseUrl = mediaConfig.stableDiffusionUrl) {}

  async healthCheck(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/sdapi/v1/options`, {
      signal: AbortSignal.timeout(5_000),
    }).catch((error: unknown) => {
      throw new Error(
        `Stable Diffusion no responde en ${this.baseUrl}. ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
    if (!response.ok) {
      throw new Error(`Stable Diffusion respondió HTTP ${response.status}.`);
    }
  }

  async generate(request: ImageGenerationRequest): Promise<string> {
    const response = await fetch(`${this.baseUrl}/sdapi/v1/txt2img`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: request.prompt,
        negative_prompt:
          request.negativePrompt ??
          "text, watermark, logo, low quality, blurry, deformed, extra limbs",
        width: mediaConfig.stableDiffusionWidth,
        height: mediaConfig.stableDiffusionHeight,
        steps: mediaConfig.stableDiffusionSteps,
        sampler_name: mediaConfig.stableDiffusionSampler,
        seed: request.seed ?? -1,
        batch_size: 1,
        n_iter: 1,
      }),
      signal: AbortSignal.timeout(10 * 60_000),
    });
    const payload = (await response.json()) as StableDiffusionResponse;
    if (!response.ok || !payload.images?.[0]) {
      throw new Error(
        `Stable Diffusion no generó imagen: ${payload.detail ?? response.statusText}`,
      );
    }

    await mkdir(path.dirname(request.outputPath), { recursive: true });
    const base64 = payload.images[0].replace(/^data:image\/\w+;base64,/u, "");
    const temporaryPath = request.outputPath.replace(/\.png$/iu, ".source.png");
    await writeFile(temporaryPath, Buffer.from(base64, "base64"));
    await runProcess(mediaConfig.ffmpegPath, [
      "-y",
      "-i",
      temporaryPath,
      "-vf",
      `scale=${request.width}:${request.height}:force_original_aspect_ratio=increase,crop=${request.width}:${request.height}`,
      request.outputPath,
    ]);
    await unlink(temporaryPath).catch(() => undefined);
    return request.outputPath;
  }
}
