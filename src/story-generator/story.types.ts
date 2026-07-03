import type { StoryFormula } from "../config/constants";

export interface StoryDraft {
  formula: StoryFormula;
  hook: string;
  storyBody: string;
  twistEnding: string;
}

export interface NarrativeParts {
  subject: string;
  device: string;
  time: string;
  place: string;
  anomaly: string;
  warning: string;
  consequence: string;
  identity: string;
}
