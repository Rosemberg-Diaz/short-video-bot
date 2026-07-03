import { spawn } from "node:child_process";
import { mediaConfig } from "../config/media.config";
import { runProcess } from "./process";

export async function probeDuration(filePath: string): Promise<number> {
  const duration = await probeWithFfprobe(filePath).catch(() =>
    probeWithFfmpeg(filePath),
  );
  if (!Number.isFinite(duration)) {
    throw new Error(`No se pudo determinar la duracion de ${filePath}.`);
  }
  return duration;
}

async function probeWithFfprobe(filePath: string): Promise<number> {
  const { stdout } = await runProcess(mediaConfig.ffprobePath, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  return Number(stdout.trim());
}

function probeWithFfmpeg(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(mediaConfig.ffmpegPath, ["-hide_banner", "-i", filePath], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", () => {
      const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/u);
      if (!match) {
        reject(new Error(`FFmpeg no pudo determinar la duracion de ${filePath}.`));
        return;
      }
      const [, hours, minutes, seconds] = match;
      resolve(Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds));
    });
  });
}
