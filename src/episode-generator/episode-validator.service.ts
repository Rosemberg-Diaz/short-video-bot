import type { Episode } from "@prisma/client";
import {
  MAX_HOOK_WORDS,
  SIMILARITY_THRESHOLD,
} from "../config/constants";
import { countWords, isValidDuration, textSimilarity } from "../utils/text";
import type { StoryDraft } from "../story-generator/story.types";
import type { EpisodeMetadata } from "../metadata-generator/metadata.types";

export interface CandidateEpisode extends StoryDraft, EpisodeMetadata {
  narration: string;
}

export class EpisodeValidatorService {
  validate(candidate: CandidateEpisode, existing: Episode[]): string[] {
    const errors: string[] = [];

    if (countWords(candidate.hook) > MAX_HOOK_WORDS) {
      errors.push(`El hook supera ${MAX_HOOK_WORDS} palabras.`);
    }

    if (!isValidDuration(candidate.narration)) {
      errors.push("La narración no dura entre 10 y 20 segundos.");
    }

    if (!this.hasCompleteNarrativeArc(candidate)) {
      errors.push("La historia no contiene planteamiento, escalada y desenlace.");
    }

    for (const episode of existing) {
      this.compareField("título", candidate.title, episode.title, errors);
      this.compareField("hook", candidate.hook, episode.hook, errors);
      this.compareField(
        "twist",
        candidate.twistEnding,
        episode.twistEnding,
        errors,
      );
    }

    return errors;
  }

  private hasCompleteNarrativeArc(candidate: CandidateEpisode): boolean {
    const bodySentences =
      candidate.storyBody.match(/[^.!?]+[.!?]+|[^.!?]+$/gu)?.filter(
        (sentence) => sentence.trim().length > 0,
      ) ?? [];
    return (
      bodySentences.length >= 2 &&
      countWords(candidate.storyBody) >= 15 &&
      countWords(candidate.twistEnding) >= 7
    );
  }

  private compareField(
    label: string,
    candidate: string,
    existing: string,
    errors: string[],
  ): void {
    const similarity = textSimilarity(candidate, existing);
    if (similarity > SIMILARITY_THRESHOLD) {
      errors.push(
        `El ${label} tiene ${(similarity * 100).toFixed(1)}% de similitud.`,
      );
    }
  }
}
