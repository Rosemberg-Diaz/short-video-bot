import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getStringArgument } from "../utils/cli";
import { slugify } from "../utils/text";
import type { TopVideoManifest } from "./top-video.types";

async function main(): Promise<void> {
  const title = getStringArgument("title") ?? "Top 5 viral moments";
  const slug = getStringArgument("slug") ?? slugify(title);
  const directory = path.join("assets", "approved_clips", slug);
  await mkdir(directory, { recursive: true });

  const manifest: TopVideoManifest = {
    title,
    slug,
    description: "Top 5 armado con clips revisados manualmente.",
    voiceoverStyle: "Narrador rapido, curioso y con remates cortos.",
    hashtags: ["#Shorts", "#Top5", "#Viral"],
    clips: [5, 4, 3, 2, 1].map((rank) => ({
      rank,
      file: `clip-${rank}.mp4`,
      title: `Momento ${rank}`,
      creator: "@creator",
      sourceUrl: "https://...",
      startSeconds: 0,
      durationSeconds: 6,
    })),
  };

  const manifestPath = path.join(directory, "top.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Top inicializado: ${manifestPath}`);
  console.log("Pon los 5 clips en esa carpeta y ajusta top.json antes de renderizar.");
}

main().catch((error: unknown) => {
  console.error("No fue posible inicializar el top.", error);
  process.exitCode = 1;
});
