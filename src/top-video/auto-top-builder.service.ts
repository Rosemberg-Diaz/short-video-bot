import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { mediaConfig } from "../config/media.config";
import type { ResolvedClipCandidate, TopProposal } from "../trend-scouting/trend-scouting.types";
import { assertExecutable, runProcess } from "../utils/process";
import { slugify } from "../utils/text";
import { TopVideoBuilderService } from "./top-video-builder.service";
import type { TopBuildResult, TopClip, TopVideoManifest } from "./top-video.types";

export interface AutoTopBuildResult extends TopBuildResult {
  manifestPath: string;
  downloadedClips: TopClip[];
}

export class AutoTopBuilderService {
  private readonly builder = new TopVideoBuilderService();

  async buildFromProposal(proposal: TopProposal): Promise<AutoTopBuildResult> {
    await assertExecutable(mediaConfig.ytDlpPath, ["--version"]);

    const selectedClips = this.selectClips(proposal);
    const slug = slugify(proposal.title);
    const directory = path.join("assets", "approved_clips", slug);
    await mkdir(directory, { recursive: true });

    const topClips: TopClip[] = [];
    for (const { rank, clip } of selectedClips) {
      const file = `clip-${rank}.mp4`;
      const outputPath = path.join(directory, file);
      await this.downloadClip(clip.url, outputPath);
      topClips.push({
        rank,
        file,
        title: this.toEditorialClipTitle(clip.title),
        creator: clip.creator,
        sourceUrl: clip.url,
        startSeconds: 0,
        durationSeconds: Math.min(clip.durationSeconds ?? 6, 8),
      });
      console.log(`Descargado clip #${rank}: ${outputPath}`);
    }

    const manifest: TopVideoManifest = {
      title: proposal.suggestedVideoTitle || proposal.title,
      slug,
      description: proposal.angle,
      voiceoverStyle: proposal.voiceoverStyle,
      hashtags: proposal.hashtags,
      clips: topClips,
    };
    const manifestPath = path.join(directory, "top.json");
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    console.log(`Manifest creado: ${manifestPath}`);

    const buildResult = await this.builder.build(manifestPath);
    return {
      ...buildResult,
      manifestPath,
      downloadedClips: topClips,
    };
  }

  private selectClips(
    proposal: TopProposal,
  ): Array<{ rank: number; clip: ResolvedClipCandidate }> {
    const selected: Array<{ rank: number; clip: ResolvedClipCandidate }> = [];
    const usedUrls = new Set<string>();

    for (const candidate of proposal.candidateClips) {
      const clip = candidate.resolvedClips?.find((resolved) => !usedUrls.has(resolved.url));
      if (!clip) continue;
      selected.push({ rank: selected.length + 1, clip });
      usedUrls.add(clip.url);
      if (selected.length === 5) break;
    }

    if (selected.length !== 5) {
      throw new Error(
        `No hay 5 clips resueltos para "${proposal.title}". Ejecuta con --resolve-clips=true y YOUTUBE_SEARCH_API_KEY configurado.`,
      );
    }
    return selected;
  }

  private async downloadClip(url: string, outputPath: string): Promise<void> {
    await runProcess(mediaConfig.ytDlpPath, [
      "--no-playlist",
      "--restrict-filenames",
      "--merge-output-format",
      "mp4",
      "-f",
      "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b",
      "-o",
      outputPath,
      url,
    ]);
  }

  private toEditorialClipTitle(title: string): string {
    const cleaned = title
      .replace(/#\w+/gu, " ")
      .replace(/\([^)]*\)/gu, " ")
      .replace(/\bclick\b.*$/iu, " ")
      .replace(/\bsubscribe\b.*$/iu, " ")
      .replace(/\bsupport my\b.*$/iu, " ")
      .replace(/[^\p{L}\p{N}\s.,:;!?]/gu, " ")
      .replace(/\s+/gu, " ")
      .trim();

    if (cleaned.length <= 32) return cleaned;
    return `${cleaned.slice(0, 29).trim()}...`;
  }
}
