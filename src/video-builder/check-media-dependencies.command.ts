import { ShortBuilderService } from "./short-builder.service";

async function main(): Promise<void> {
  await new ShortBuilderService().healthCheck();
  console.log("FFmpeg, FFprobe, Piper y Stable Diffusion están disponibles.");
}

main().catch((error: unknown) => {
  console.error(
    "Dependencias multimedia incompletas:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
