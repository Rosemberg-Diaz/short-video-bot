import { MAX_HOOK_WORDS, SIMILARITY_THRESHOLD } from "../config/constants";
import { prisma } from "../database/client";
import { countWords, textSimilarity } from "../utils/text";

async function main(): Promise<void> {
  const episodes = await prisma.episode.findMany({ orderBy: { id: "asc" } });
  const violations: string[] = [];
  const uniqueTitles = new Set<string>();
  const uniqueHooks = new Set<string>();
  const uniqueTwists = new Set<string>();
  let highestSimilarity = 0;

  for (const episode of episodes) {
    if (countWords(episode.hook) > MAX_HOOK_WORDS) {
      violations.push(`#${episode.id}: hook demasiado largo.`);
    }
    if (
      episode.estimatedDurationSeconds < 10 ||
      episode.estimatedDurationSeconds > 20
    ) {
      violations.push(`#${episode.id}: duración fuera del rango.`);
    }
    if (uniqueTitles.has(episode.title)) {
      violations.push(`#${episode.id}: título repetido.`);
    }
    if (uniqueHooks.has(episode.hook)) {
      violations.push(`#${episode.id}: hook repetido.`);
    }
    if (uniqueTwists.has(episode.twistEnding)) {
      violations.push(`#${episode.id}: twist repetido.`);
    }
    uniqueTitles.add(episode.title);
    uniqueHooks.add(episode.hook);
    uniqueTwists.add(episode.twistEnding);
  }

  for (let left = 0; left < episodes.length; left += 1) {
    for (let right = left + 1; right < episodes.length; right += 1) {
      const first = episodes[left]!;
      const second = episodes[right]!;
      for (const [label, firstValue, secondValue] of [
        ["título", first.title, second.title],
        ["hook", first.hook, second.hook],
        ["twist", first.twistEnding, second.twistEnding],
      ] as const) {
        const similarity = textSimilarity(firstValue, secondValue);
        highestSimilarity = Math.max(highestSimilarity, similarity);
        if (similarity > SIMILARITY_THRESHOLD) {
          violations.push(
            `#${first.id}/#${second.id}: ${label} ${(similarity * 100).toFixed(1)}% similar.`,
          );
        }
      }
    }
  }

  console.log(`Episodios auditados: ${episodes.length}`);
  console.log(`Mayor similitud protegida: ${(highestSimilarity * 100).toFixed(1)}%`);
  console.log(`Violaciones: ${violations.length}`);

  if (violations.length > 0) {
    console.error(violations.slice(0, 20).join("\n"));
    process.exitCode = 1;
  }
}

main()
  .catch((error: unknown) => {
    console.error("No fue posible auditar los episodios.", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
