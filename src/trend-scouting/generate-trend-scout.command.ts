import "dotenv/config";
import path from "node:path";
import { RENDER_STATUS } from "../config/constants";
import { getYouTubeConfig } from "../config/youtube.config";
import { prisma } from "../database/client";
import { getPositiveIntegerArgument, getStringArgument } from "../utils/cli";
import { AutoTopBuilderService } from "../top-video/auto-top-builder.service";
import { YouTubeUploaderService } from "../youtube-uploader/youtube-uploader.service";
import { TrendScoutingService } from "./trend-scouting.service";

function parseDateArgument(): Date | undefined {
  const rawDate = getStringArgument("date");
  if (!rawDate) return undefined;

  const date = new Date(`${rawDate}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("--date debe usar formato YYYY-MM-DD.");
  }
  return date;
}

async function main(): Promise<void> {
  const proposalCount = getPositiveIntegerArgument("proposals", 2);
  const candidatesPerProposal = getPositiveIntegerArgument("candidates", 8);
  const offline = getStringArgument("offline") === "true";
  const resolveClips = getStringArgument("resolve-clips") === "true";
  const autoBuild = getStringArgument("auto-build") === "true";
  const autoPublish = getStringArgument("auto-publish") === "true";
  const autoBuildRank = getPositiveIntegerArgument("auto-build-rank", 1);
  const outputDirectory =
    getStringArgument("out") ?? path.join("output", "trend-scouting");

  const service = new TrendScoutingService();
  const report = await service.generateLiveReport({
    date: parseDateArgument(),
    proposalCount,
    candidatesPerProposal,
    offline,
    resolveClips: resolveClips || autoBuild || autoPublish,
  });
  const result = await service.exportReport(report, outputDirectory);

  console.log(`Propuestas generadas: ${report.proposals.length}`);
  console.log(`Fuente: ${report.sourceStatus}`);
  console.log(`Clips: ${report.clipSourceStatus}`);
  for (const proposal of report.proposals) {
    console.log(`#${proposal.rank} ${proposal.title} (${proposal.score})`);
  }
  console.log(`JSON: ${result.jsonPath}`);
  console.log(`Markdown: ${result.markdownPath}`);

  if (autoBuild || autoPublish) {
    const proposal = report.proposals.find((item) => item.rank === autoBuildRank);
    if (!proposal) {
      throw new Error(`No existe propuesta con rank ${autoBuildRank}.`);
    }
    const build = await new AutoTopBuilderService().buildFromProposal(proposal);
    console.log(`Top automatico renderizado: ${build.videoPath}`);
    console.log(`Manifest automatico: ${build.manifestPath}`);
    console.log(`Metadata: ${build.metadataPath}`);

    const topVideo = await prisma.topVideo.create({
      data: {
        title: proposal.suggestedVideoTitle,
        slug: proposal.title.toLowerCase().replace(/[^a-z0-9]+/giu, "-").replace(/^-|-$/gu, ""),
        proposalRank: proposal.rank,
        score: proposal.score,
        category: proposal.category,
        angle: proposal.angle,
        description: proposal.angle,
        hashtags: proposal.hashtags.join(" "),
        manifestPath: build.manifestPath,
        metadataPath: build.metadataPath,
        videoPath: build.videoPath,
        sourceReportPath: result.jsonPath,
        clipsJson: JSON.stringify(build.downloadedClips),
        renderStatus: RENDER_STATUS.COMPLETED,
      },
    });
    console.log(`Top registrado en Prisma: #${topVideo.id}`);

    if (autoPublish) {
      const youtubeConfig = getYouTubeConfig("viral-tops");
      const uploaded = await new YouTubeUploaderService(youtubeConfig).uploadTopVideo(topVideo, "public");
      console.log(`YouTube viral-tops publicado: ${uploaded.youtubeUrl}`);
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error("No fue posible generar las propuestas de tendencias.", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
