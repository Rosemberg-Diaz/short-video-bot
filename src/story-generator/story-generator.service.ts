import type { StoryFormula } from "../config/constants";
import { randomItem } from "../utils/random";
import {
  DEVICES,
  PLACES,
  STORY_ARCS,
  SUBJECTS,
  TIMES,
} from "./story.templates";
import type { NarrativeParts, StoryDraft } from "./story.types";

export class StoryGeneratorService {
  generate(formula: StoryFormula): StoryDraft {
    const parts: NarrativeParts = {
      subject: randomItem(SUBJECTS),
      device: randomItem(DEVICES),
      time: randomItem(TIMES),
      place: randomItem(PLACES),
      anomaly: "",
      warning: "",
      consequence: "",
      identity: "",
    };
    return randomItem(STORY_ARCS[formula])(parts);
  }
}
