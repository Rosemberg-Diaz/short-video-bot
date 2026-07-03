import type { Episode, Scene, Series } from "@prisma/client";
import { prisma } from "../database/client";
import { countWords } from "../utils/text";
import type { GeneratedScene } from "./scene.types";

type EpisodeWithSeries = Episode & { series: Series };

const VISUAL_STYLES = [
  "cinematic technological horror, photorealistic, ominous shadows",
  "analog horror atmosphere, realistic surveillance lighting",
  "dark sci-fi thriller, volumetric light, unsettling composition",
  "found footage aesthetic, eerie practical lighting, high detail",
];

export class SceneGeneratorService {
  async generate(episode: EpisodeWithSeries): Promise<Scene[]> {
    const existing = await prisma.scene.findMany({
      where: { episodeId: episode.id },
      orderBy: { sceneNumber: "asc" },
    });
    if (existing.length === 4) return existing;

    const scenes = this.createScenes(episode);
    await prisma.$transaction([
      prisma.scene.deleteMany({ where: { episodeId: episode.id } }),
      ...scenes.map((scene) =>
        prisma.scene.create({
          data: { episodeId: episode.id, ...scene },
        }),
      ),
    ]);

    return prisma.scene.findMany({
      where: { episodeId: episode.id },
      orderBy: { sceneNumber: "asc" },
    });
  }

  createScenes(episode: EpisodeWithSeries): GeneratedScene[] {
    const parts = [
      episode.hook,
      ...this.splitBody(episode.storyBody),
      episode.twistEnding,
    ];
    const totalWords = parts.reduce((sum, part) => sum + countWords(part), 0);
    const totalDuration = Math.min(
      20,
      Math.max(10, episode.estimatedDurationSeconds),
    );

    return parts.map((narration, index) => ({
      sceneNumber: index + 1,
      narration,
      durationSeconds: Number(
        ((countWords(narration) / totalWords) * totalDuration).toFixed(3),
      ),
      imagePrompt: this.buildPrompt(episode, narration, index),
    }));
  }

  private splitBody(body: string): [string, string] {
    const sentences = body.match(/[^.!?]+[.!?]+|[^.!?]+$/gu)?.map((part) => part.trim()) ?? [];
    if (sentences.length >= 2) {
      const midpoint = Math.ceil(sentences.length / 2);
      return [
        sentences.slice(0, midpoint).join(" "),
        sentences.slice(midpoint).join(" "),
      ];
    }

    const words = body.split(/\s+/u);
    const midpoint = Math.ceil(words.length / 2);
    return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")];
  }

  private buildPrompt(
    episode: EpisodeWithSeries,
    narration: string,
    index: number,
  ): string {
    return [
      narration,
      `same protagonist and location continuity across all four scenes`,
      `series concept: ${episode.series.name}`,
      VISUAL_STYLES[index],
      "vertical portrait composition, 9:16, no text, no watermark",
    ].join(", ");
  }
}
