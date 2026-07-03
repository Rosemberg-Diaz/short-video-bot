import type { Episode, Series } from "@prisma/client";
import {
  EPISODE_STATUS,
  MAX_GENERATION_ATTEMPTS,
  type StoryFormula,
} from "../config/constants";
import { SERIES_FORMULAS } from "../config/series.config";
import { prisma } from "../database/client";
import { MetadataGeneratorService } from "../metadata-generator/metadata-generator.service";
import { SeriesService } from "../series/series.service";
import { StoryGeneratorService } from "../story-generator/story-generator.service";
import { randomItem } from "../utils/random";
import { estimateDurationSeconds } from "../utils/text";
import { EpisodeExporterService } from "./episode-exporter.service";
import {
  type CandidateEpisode,
  EpisodeValidatorService,
} from "./episode-validator.service";

export type GeneratedEpisode = Episode & { series: Series };

export class EpisodeGeneratorService {
  private readonly seriesService = new SeriesService();
  private readonly storyGenerator = new StoryGeneratorService();
  private readonly metadataGenerator = new MetadataGeneratorService();
  private readonly validator = new EpisodeValidatorService();
  private readonly exporter = new EpisodeExporterService();

  async generate(seriesName?: string): Promise<GeneratedEpisode> {
    const series = await this.seriesService.select(seriesName);
    const existing = await prisma.episode.findMany();

    for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
      const formula = this.selectFormula(series.name);
      const story = this.storyGenerator.generate(formula);
      const metadata = this.metadataGenerator.generate(story, series.name);
      const narration = [story.hook, story.storyBody, story.twistEnding].join(" ");
      const candidate: CandidateEpisode = {
        ...story,
        ...metadata,
        narration,
      };
      const validationErrors = this.validator.validate(candidate, existing);

      if (validationErrors.length > 0) continue;

      try {
        const episode = await prisma.episode.create({
          data: {
            seriesId: series.id,
            title: candidate.title,
            hook: candidate.hook,
            storyBody: candidate.storyBody,
            twistEnding: candidate.twistEnding,
            storyFormula: candidate.formula,
            estimatedViralityScore: candidate.estimatedViralityScore,
            status: EPISODE_STATUS.GENERATED,
            description: candidate.description,
            hashtags: JSON.stringify(candidate.hashtags),
            estimatedDurationSeconds: estimateDurationSeconds(narration),
          },
          include: { series: true },
        });

        await this.exporter.export(episode);
        return episode;
      } catch (error: unknown) {
        if (this.isUniqueConstraintError(error)) continue;
        throw error;
      }
    }

    throw new Error(
      `No se pudo crear un episodio único después de ${MAX_GENERATION_ATTEMPTS} intentos.`,
    );
  }

  private selectFormula(seriesName: string): StoryFormula {
    const formulas = SERIES_FORMULAS.get(seriesName);
    if (!formulas?.length) {
      throw new Error(`No hay fórmulas configuradas para "${seriesName}".`);
    }
    return randomItem(formulas);
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    );
  }
}
