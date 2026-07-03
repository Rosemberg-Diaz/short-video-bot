import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { slugify } from "../utils/text";
import { TrendSourceService } from "./trend-source.service";
import { TREND_TOPICS } from "./trend-topics";
import { YouTubeClipSearchService } from "./youtube-clip-search.service";
import type {
  ClipReviewCandidate,
  TopProposal,
  TrendSignal,
  TrendPlatform,
  TrendScoutReport,
  TrendTopic,
} from "./trend-scouting.types";

const PLATFORMS: TrendPlatform[] = ["TikTok", "YouTube Shorts", "Instagram Reels"];

export class TrendScoutingService {
  private readonly trendSource = new TrendSourceService();
  private readonly clipSearch = new YouTubeClipSearchService();

  async generateLiveReport(options?: {
    date?: Date;
    proposalCount?: number;
    candidatesPerProposal?: number;
    offline?: boolean;
    resolveClips?: boolean;
  }): Promise<TrendScoutReport> {
    const signals = options?.offline ? [] : await this.trendSource.fetchSignals();
    const report = this.generateReport({
      ...options,
      signals,
    });
    if (!options?.resolveClips) return report;
    return this.resolveClips(report);
  }

  generateReport(options?: {
    date?: Date;
    proposalCount?: number;
    candidatesPerProposal?: number;
    signals?: TrendSignal[];
  }): TrendScoutReport {
    const date = options?.date ?? new Date();
    const dateKey = this.toDateKey(date);
    const proposalCount = options?.proposalCount ?? 2;
    const candidatesPerProposal = options?.candidatesPerProposal ?? 8;
    const signals = options?.signals ?? [];

    const proposals = TREND_TOPICS
      .map((topic) =>
        this.toProposal(topic, dateKey, candidatesPerProposal, signals),
      )
      .sort((left, right) => right.score - left.score)
      .slice(0, proposalCount)
      .map((proposal, index) => ({ ...proposal, rank: index + 1 }));

    return {
      generatedAt: date.toISOString(),
      dateKey,
      proposalCount,
      candidatesPerProposal,
      proposals,
      sourceStatus:
        signals.length > 0
          ? `live:${signals.length} trend signals`
          : "fallback:offline topic rotation",
      clipSourceStatus: "not requested",
      sourceSignals: signals,
      workflow: [
        "Revisar las 2 propuestas con mayor score.",
        "Abrir las busquedas sugeridas y escoger clips con permiso, licencia o uso aprobado.",
        "Descargar manualmente los 5 clips finales por propuesta.",
        "Guardar los archivos en assets/approved_clips/<slug-del-top>/.",
        "Registrar creador y URL fuente antes de ensamblar el Short.",
      ],
    };
  }

  private async resolveClips(report: TrendScoutReport): Promise<TrendScoutReport> {
    if (!this.clipSearch.isConfigured()) {
      return {
        ...report,
        clipSourceStatus:
          "not configured: set YOUTUBE_SEARCH_API_KEY to get specific clip URLs",
      };
    }

    let resolvedCount = 0;
    const proposals = [];
    for (const proposal of report.proposals) {
      const candidateClips = [];
      for (const candidate of proposal.candidateClips) {
        const query = candidate.searchQueries[0]!;
        const resolvedClips = await this.clipSearch.search(query, {
          maxResults: 6,
        });
        resolvedCount += resolvedClips.length;
        candidateClips.push({
          ...candidate,
          resolvedClips: resolvedClips.slice(0, 3),
        });
      }
      proposals.push({ ...proposal, candidateClips });
    }

    return {
      ...report,
      proposals,
      clipSourceStatus: `youtube:${resolvedCount} specific clip candidates`,
    };
  }

  async exportReport(report: TrendScoutReport, outputDirectory: string): Promise<{
    jsonPath: string;
    markdownPath: string;
  }> {
    await mkdir(outputDirectory, { recursive: true });
    const baseName = `${report.dateKey}-top-proposals`;
    const jsonPath = path.join(outputDirectory, `${baseName}.json`);
    const markdownPath = path.join(outputDirectory, `${baseName}.md`);

    await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await writeFile(markdownPath, this.toMarkdown(report), "utf8");

    return { jsonPath, markdownPath };
  }

  private toProposal(
    topic: TrendTopic,
    dateKey: string,
    candidatesPerProposal: number,
    signals: TrendSignal[],
  ): TopProposal {
    const dailyBoost = this.dailyBoost(topic.id, dateKey);
    const trendMatches = this.matchSignals(topic, signals);
    const liveBoost = Math.min(18, trendMatches.length * 6);
    const score = Math.round(
      topic.baseScore * 0.38 +
        topic.retentionScore * 0.26 +
        topic.clipAvailabilityScore * 0.22 +
        topic.safetyScore * 0.14 +
        dailyBoost +
        liveBoost,
    );
    const title = topic.title;

    return {
      rank: 0,
      score,
      title,
      category: topic.category,
      angle: topic.angle,
      whyThisCanWork: [
        `Categoria con buena disponibilidad de clips: ${topic.clipAvailabilityScore}/100.`,
        `Promesa visual rapida para Shorts: ${topic.retentionScore}/100.`,
        `Riesgo editorial manejable si se evitan: ${topic.avoid.join(", ")}.`,
        ...(trendMatches.length
          ? [`Coincide con senales actuales: ${trendMatches.map((signal) => signal.title).join(", ")}.`]
          : []),
      ],
      suggestedVideoTitle: `${title} que parecen irreales #Shorts`,
      voiceoverStyle:
        "Narrador rapido, curioso y con remates cortos; explicar en una frase por que cada clip entra al ranking.",
      candidateClips: this.buildCandidates(topic, candidatesPerProposal),
      hashtags: this.buildHashtags(topic),
      trendSignals: trendMatches,
    };
  }

  private matchSignals(topic: TrendTopic, signals: TrendSignal[]): TrendSignal[] {
    if (signals.length === 0) return [];
    const topicTerms = [
      topic.title,
      topic.category,
      topic.angle,
      ...topic.keywords,
    ]
      .join(" ")
      .toLowerCase();

    return signals
      .filter((signal) => {
        const signalText = [signal.title, ...signal.relatedQueries]
          .join(" ")
          .toLowerCase();
        return this.hasSignalMatch(topicTerms, signalText);
      })
      .slice(0, 3);
  }

  private hasSignalMatch(topicTerms: string, signalText: string): boolean {
    const buckets = [
      ["july", "4th", "fourth", "independence", "fireworks", "party", "beach", "pool", "outfit"],
      ["fail", "fails", "funny", "unexpected", "accident", "mistake"],
      ["pet", "pets", "dog", "cat", "animal"],
      ["food", "recipe", "restaurant", "eat"],
      ["gadget", "amazon", "product", "device"],
      ["sport", "nba", "nfl", "soccer", "mlb", "game"],
      ["game", "gaming", "fortnite", "minecraft", "roblox"],
      ["2016", "nostalgia", "throwback", "meme", "challenge"],
    ];

    return buckets.some((bucket) => {
      const topicHit = bucket.some((term) => topicTerms.includes(term));
      const signalHit = bucket.some((term) => signalText.includes(term));
      return topicHit && signalHit;
    });
  }

  private buildCandidates(
    topic: TrendTopic,
    count: number,
  ): ClipReviewCandidate[] {
    return Array.from({ length: count }, (_, index) => {
      const rank = index + 1;
      const keyword = topic.keywords[index % topic.keywords.length]!;
      const hook = this.clipHook(topic, rank);
      return {
        rank,
        hook,
        clipBrief: `${topic.angle}; buscar un clip con remate claro antes del segundo 3.`,
        idealDurationSeconds: rank <= 5 ? "5-8" : "4-7",
        searchQueries: this.buildSearchQueries(keyword, topic.category),
        searchUrls: this.buildSearchUrls(keyword),
        platforms: PLATFORMS,
        selectionNotes: [
          "Priorizar clips verticales 9:16 o faciles de recortar.",
          "Evitar clips con lesiones, humillacion fuerte o contexto confuso.",
          "Guardar URL, creador y plataforma junto al archivo descargado.",
        ],
      };
    });
  }

  private buildSearchQueries(keyword: string, category: string): string[] {
    return [
      `${keyword} viral short`,
      `${keyword} this week`,
      `${keyword} top moments`,
      `${category} viral clips shorts`,
    ];
  }

  private buildSearchUrls(keyword: string): string[] {
    const encodedKeyword = encodeURIComponent(keyword);
    return [
      `https://www.tiktok.com/search?q=${encodedKeyword}`,
      `https://www.youtube.com/results?search_query=${encodedKeyword}%20shorts`,
      `https://www.instagram.com/explore/search/keyword/?q=${encodedKeyword}`,
    ];
  }

  private clipHook(topic: TrendTopic, rank: number): string {
    const openers = [
      "Este tenia que entrar al top",
      "El remate de este clip es perfecto",
      "Este momento parece actuado, pero no",
      "Aqui es donde todo cambia",
      "Este es el tipo de clip que retiene",
    ];
    return `${openers[(rank - 1) % openers.length]}: ${topic.angle}.`;
  }

  private buildHashtags(topic: TrendTopic): string[] {
    const categoryTag = `#${slugify(topic.category).replace(/-/gu, "")}`;
    return ["#Shorts", "#Top5", "#Viral", categoryTag].slice(0, 4);
  }

  private dailyBoost(topicId: string, dateKey: string): number {
    const hash = Array.from(`${dateKey}:${topicId}`).reduce(
      (total, character) => total + character.charCodeAt(0),
      0,
    );
    return (hash % 13) - 4;
  }

  private toDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private toMarkdown(report: TrendScoutReport): string {
    const lines = [
      `# Top proposals ${report.dateKey}`,
      "",
      `Generated at: ${report.generatedAt}`,
      `Source status: ${report.sourceStatus}`,
      `Clip source status: ${report.clipSourceStatus}`,
      "",
      "## Source Signals",
      ...(report.sourceSignals.length
        ? report.sourceSignals.map((signal) => `- ${signal.title}${signal.traffic ? ` (${signal.traffic})` : ""}`)
        : ["- No live signals found; using offline rotation."]),
      "",
      "## Workflow",
      ...report.workflow.map((item, index) => `${index + 1}. ${item}`),
      "",
    ];

    for (const proposal of report.proposals) {
      lines.push(
        `## ${proposal.rank}. ${proposal.title}`,
        "",
        `Score: ${proposal.score}`,
        `Category: ${proposal.category}`,
        `Angle: ${proposal.angle}`,
        `Suggested title: ${proposal.suggestedVideoTitle}`,
        `Voiceover: ${proposal.voiceoverStyle}`,
        `Hashtags: ${proposal.hashtags.join(" ")}`,
        "",
        "Why it can work:",
        ...proposal.whyThisCanWork.map((reason) => `- ${reason}`),
        "",
        "Clip review candidates:",
      );

      for (const candidate of proposal.candidateClips) {
        lines.push(
          "",
          `### Candidate ${candidate.rank}`,
          "",
          `Hook: ${candidate.hook}`,
          `Brief: ${candidate.clipBrief}`,
          `Ideal duration: ${candidate.idealDurationSeconds}s`,
          `Platforms: ${candidate.platforms.join(", ")}`,
          "Search queries:",
          ...candidate.searchQueries.map((query) => `- ${query}`),
          "Search URLs:",
          ...candidate.searchUrls.map((url) => `- ${url}`),
          "Specific clip candidates:",
          ...(candidate.resolvedClips?.length
            ? candidate.resolvedClips.map(
                (clip) =>
                  `- [${clip.title}](${clip.url}) | ${clip.creator} | score ${clip.score}` +
                  `${clip.viewCount ? ` | ${clip.viewCount.toLocaleString("en-US")} views` : ""}` +
                  `${clip.durationSeconds ? ` | ${Math.round(clip.durationSeconds)}s` : ""}`,
              )
            : ["- No specific clips resolved for this candidate."]),
          "Selection notes:",
          ...candidate.selectionNotes.map((note) => `- ${note}`),
        );
      }

      lines.push("");
    }

    return `${lines.join("\n")}\n`;
  }
}
