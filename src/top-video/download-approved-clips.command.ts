import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getStringArgument } from "../utils/cli";
import type { TopClip, TopVideoManifest } from "./top-video.types";

interface DownloadClipInput extends TopClip {
  url: string;
  rightsConfirmed: boolean;
}

interface DownloadManifestInput {
  title: string;
  slug: string;
  description?: string;
  hashtags?: string[];
  voiceoverStyle?: string;
  clips: DownloadClipInput[];
}

const BLOCKED_HOSTS = [
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "instagram.com",
  "facebook.com",
  "x.com",
  "twitter.com",
];

async function main(): Promise<void> {
  const manifestPath = getStringArgument("manifest");
  if (!manifestPath) {
    throw new Error("Uso: npm run tops:download-approved -- --manifest=path/to/download.json");
  }

  const input = JSON.parse(await readFile(manifestPath, "utf8")) as DownloadManifestInput;
  validateInput(input);

  const directory = path.join("assets", "approved_clips", input.slug);
  await mkdir(directory, { recursive: true });

  const topClips: TopClip[] = [];
  for (const clip of input.clips) {
    const outputPath = path.join(directory, clip.file);
    await downloadClip(clip.url, outputPath);
    topClips.push({
      rank: clip.rank,
      file: clip.file,
      title: clip.title,
      creator: clip.creator,
      sourceUrl: clip.sourceUrl || clip.url,
      startSeconds: clip.startSeconds ?? 0,
      durationSeconds: clip.durationSeconds,
    });
    console.log(`Descargado clip #${clip.rank}: ${outputPath}`);
  }

  const topManifest: TopVideoManifest = {
    title: input.title,
    slug: input.slug,
    description: input.description,
    voiceoverStyle: input.voiceoverStyle,
    hashtags: input.hashtags,
    clips: topClips.sort((left, right) => right.rank - left.rank),
  };

  const topManifestPath = path.join(directory, "top.json");
  await writeFile(topManifestPath, `${JSON.stringify(topManifest, null, 2)}\n`, "utf8");
  console.log(`Manifest creado: ${topManifestPath}`);
}

function validateInput(input: DownloadManifestInput): void {
  if (!input.title?.trim()) throw new Error("El manifest necesita title.");
  if (!input.slug?.trim()) throw new Error("El manifest necesita slug.");
  if (!Array.isArray(input.clips) || input.clips.length !== 5) {
    throw new Error("El manifest de descarga debe tener exactamente 5 clips.");
  }

  for (const clip of input.clips) {
    if (!clip.rightsConfirmed) {
      throw new Error(`El clip #${clip.rank} no tiene rightsConfirmed=true.`);
    }
    validateUrl(clip.url);
    if (!clip.file?.match(/\.(mp4|mov|mkv|webm)$/iu)) {
      throw new Error(`El clip #${clip.rank} necesita file con extension de video.`);
    }
  }
}

function validateUrl(rawUrl: string): void {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`URL no soportada: ${rawUrl}`);
  }
  const host = url.hostname.replace(/^www\./iu, "").toLowerCase();
  if (BLOCKED_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`))) {
    throw new Error(`No se permite descarga directa desde plataforma social: ${rawUrl}`);
  }
}

async function downloadClip(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`No se pudo descargar ${url}: HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("video/") && !contentType.includes("octet-stream")) {
    throw new Error(`La URL no parece video directo (${contentType}): ${url}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(outputPath, bytes);
}

main().catch((error: unknown) => {
  console.error("No fue posible descargar los clips aprobados.", error);
  process.exitCode = 1;
});
