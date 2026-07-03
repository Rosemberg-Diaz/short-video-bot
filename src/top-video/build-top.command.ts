import path from "node:path";
import { getStringArgument } from "../utils/cli";
import { TopVideoBuilderService } from "./top-video-builder.service";

async function main(): Promise<void> {
  const manifestPath =
    getStringArgument("manifest") ??
    path.join("assets", "approved_clips", "top.json");

  const result = await new TopVideoBuilderService().build(manifestPath);
  console.log(`Top renderizado: ${result.videoPath}`);
  console.log(`Metadata: ${result.metadataPath}`);
}

main().catch((error: unknown) => {
  console.error("No fue posible construir el top.", error);
  process.exitCode = 1;
});
