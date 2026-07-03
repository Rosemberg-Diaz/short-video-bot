import "dotenv/config";
import path from "node:path";
import { getPositiveIntegerArgument, getStringArgument } from "../utils/cli";
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
  const outputDirectory =
    getStringArgument("out") ?? path.join("output", "trend-scouting");

  const service = new TrendScoutingService();
  const report = await service.generateLiveReport({
    date: parseDateArgument(),
    proposalCount,
    candidatesPerProposal,
    offline,
    resolveClips,
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
}

main().catch((error: unknown) => {
  console.error("No fue posible generar las propuestas de tendencias.", error);
  process.exitCode = 1;
});
