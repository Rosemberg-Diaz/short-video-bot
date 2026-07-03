import { mediaConfig } from "../config/media.config";
import { runProcess } from "./process";

export async function probeDuration(filePath: string): Promise<number> {
  const { stdout } = await runProcess(mediaConfig.ffprobePath, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  const duration = Number(stdout.trim());
  if (!Number.isFinite(duration)) {
    throw new Error(`FFprobe no pudo determinar la duración de ${filePath}.`);
  }
  return duration;
}
