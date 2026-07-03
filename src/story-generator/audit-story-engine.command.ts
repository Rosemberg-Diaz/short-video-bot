import { STORY_FORMULAS } from "../config/constants";
import { MetadataGeneratorService } from "../metadata-generator/metadata-generator.service";
import { EpisodeValidatorService } from "../episode-generator/episode-validator.service";
import { StoryGeneratorService } from "./story-generator.service";

const storyGenerator = new StoryGeneratorService();
const metadataGenerator = new MetadataGeneratorService();
const validator = new EpisodeValidatorService();
const failures = new Map<string, number>();
let valid = 0;

for (let index = 0; index < 1_000; index += 1) {
  const formula = STORY_FORMULAS[index % STORY_FORMULAS.length]!;
  const story = storyGenerator.generate(formula);
  const metadata = metadataGenerator.generate(story, "Auditoría");
  const narration = [story.hook, story.storyBody, story.twistEnding].join(" ");
  const errors = validator.validate(
    { ...story, ...metadata, narration },
    [],
  );
  if (errors.length === 0) {
    valid += 1;
  } else {
    for (const error of errors) {
      failures.set(error, (failures.get(error) ?? 0) + 1);
    }
  }
}

console.log(`Historias válidas: ${valid}/1000`);
for (const [error, count] of [...failures.entries()].sort(
  (left, right) => right[1] - left[1],
)) {
  console.log(`${count}: ${error}`);
}
