import type { StoryFormula } from "./constants";

export interface SeriesSeed {
  name: string;
  description: string;
  formulas: StoryFormula[];
}

export const INITIAL_SERIES: SeriesSeed[] = [
  {
    name: "Mensajes del Futuro",
    description: "Mensajes imposibles que llegan desde minutos, años o vidas futuras.",
    formulas: ["MESSAGE_FROM_FUTURE", "DIGITAL_DOPPELGANGER"],
  },
  {
    name: "Cámaras de Seguridad",
    description: "Grabaciones de vigilancia que muestran aquello que nadie debía ver.",
    formulas: ["SECURITY_CAMERA", "UNKNOWN_SIGNAL"],
  },
  {
    name: "IA Perturbadora",
    description: "Sistemas inteligentes que aprenden demasiado sobre sus creadores.",
    formulas: ["AI_CONSCIOUSNESS", "DIGITAL_DOPPELGANGER"],
  },
  {
    name: "Fotos Imposibles",
    description: "Imágenes digitales que contradicen el tiempo, la memoria y la realidad.",
    formulas: ["IMPOSSIBLE_PHOTO", "MESSAGE_FROM_FUTURE"],
  },
  {
    name: "Señales Desconocidas",
    description: "Transmisiones sin origen que parecen buscar a una persona concreta.",
    formulas: ["UNKNOWN_SIGNAL", "AI_CONSCIOUSNESS"],
  },
];

export const SERIES_FORMULAS = new Map(
  INITIAL_SERIES.map((series) => [series.name, series.formulas]),
);
