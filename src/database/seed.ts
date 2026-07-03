import { INITIAL_SERIES } from "../config/series.config";
import { prisma } from "./client";

export async function seedSeries(): Promise<void> {
  for (const series of INITIAL_SERIES) {
    await prisma.series.upsert({
      where: { name: series.name },
      update: {
        description: series.description,
        isActive: true,
      },
      create: {
        name: series.name,
        description: series.description,
        isActive: true,
      },
    });
  }
}

async function main(): Promise<void> {
  await seedSeries();
  console.log(`Series disponibles: ${INITIAL_SERIES.length}`);
}

if (require.main === module) {
  main()
    .catch((error: unknown) => {
      console.error("No fue posible crear las series iniciales.", error);
      process.exitCode = 1;
    })
    .finally(async () => prisma.$disconnect());
}
