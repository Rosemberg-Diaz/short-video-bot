import "dotenv/config";
import path from "node:path";

function numberFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const mediaConfig = {
  ffmpegPath: process.env.FFMPEG_PATH || "ffmpeg",
  ffprobePath: process.env.FFPROBE_PATH || "ffprobe",
  ytDlpPath: process.env.YT_DLP_PATH || "yt-dlp",
  piperPath: process.env.PIPER_PATH || "piper",
  piperModelPath: process.env.PIPER_MODEL_PATH || "",
  stableDiffusionUrl:
    process.env.STABLE_DIFFUSION_URL || "http://127.0.0.1:7860",
  stableDiffusionSteps: numberFromEnv("STABLE_DIFFUSION_STEPS", 24),
  stableDiffusionSampler:
    process.env.STABLE_DIFFUSION_SAMPLER || "DPM++ 2M Karras",
  stableDiffusionWidth: numberFromEnv("STABLE_DIFFUSION_WIDTH", 512),
  stableDiffusionHeight: numberFromEnv("STABLE_DIFFUSION_HEIGHT", 896),
  imageWidth: 1080,
  imageHeight: 1920,
  fps: 30,
  transitionSeconds: 0.35,
  outputRoot: path.resolve("output"),
};
