import type { Series } from "@prisma/client";
import { prisma } from "../database/client";
import { randomItem } from "../utils/random";

export class SeriesService {
  async listActive(): Promise<Series[]> {
    return prisma.series.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
    });
  }

  async select(seriesName?: string): Promise<Series> {
    if (seriesName) {
      const selected = await prisma.series.findFirst({
        where: {
          name: { equals: seriesName },
          isActive: true,
        },
      });

      if (!selected) {
        throw new Error(`La serie activa "${seriesName}" no existe.`);
      }

      return selected;
    }

    const activeSeries = await this.listActive();
    if (activeSeries.length === 0) {
      throw new Error("No hay series activas disponibles.");
    }

    return randomItem(activeSeries);
  }
}
