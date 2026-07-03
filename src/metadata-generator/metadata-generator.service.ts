import type { StoryFormula } from "../config/constants";
import { randomInt, randomItem } from "../utils/random";
import type { StoryDraft } from "../story-generator/story.types";
import type { EpisodeMetadata } from "./metadata.types";

const TITLE_PREFIXES: Record<StoryFormula, string[]> = {
  MESSAGE_FROM_FUTURE: ["El mensaje de mañana", "No respondas", "Última advertencia"],
  SECURITY_CAMERA: ["Fotograma 13", "La cámara no miente", "Turno de medianoche"],
  IMPOSSIBLE_PHOTO: ["La foto imposible", "No amplíes la imagen", "Metadatos del mañana"],
  AI_CONSCIOUSNESS: ["La IA ya lo sabía", "Protocolo fantasma", "Después de ti"],
  UNKNOWN_SIGNAL: ["Frecuencia cero", "La señal te conoce", "Transmisión final"],
  DIGITAL_DOPPELGANGER: ["Tu otro perfil", "El doble en línea", "Sesión duplicada"],
};

const CHARACTER_NAMES = [
  "Lucía", "Mateo", "Elena", "Tomás", "Sofía",
  "Daniel", "Valeria", "Nicolás", "Camila", "Samuel",
];

const FORMULA_HASHTAGS: Record<StoryFormula, string[]> = {
  MESSAGE_FROM_FUTURE: ["#MensajesDelFuturo", "#Paradoja"],
  SECURITY_CAMERA: ["#CamaraDeSeguridad", "#FoundFootage"],
  IMPOSSIBLE_PHOTO: ["#FotoImposible", "#Misterio"],
  AI_CONSCIOUSNESS: ["#InteligenciaArtificial", "#IAPerturbadora"],
  UNKNOWN_SIGNAL: ["#SeñalDesconocida", "#Frecuencia"],
  DIGITAL_DOPPELGANGER: ["#DobleDigital", "#Identidad"],
};

export class MetadataGeneratorService {
  generate(story: StoryDraft, seriesName: string): EpisodeMetadata {
    const character =
      CHARACTER_NAMES.find((name) =>
        `${story.hook} ${story.storyBody}`.includes(name),
      ) ?? "alguien";
    const detail = this.inferTitleDetail(story, character);
    const title = `${randomItem(TITLE_PREFIXES[story.formula])}: ${detail}`;
    const description =
      `${story.hook} ${story.storyBody} ¿Qué habrías hecho tú? ` +
      `Episodio de ${seriesName}.`;
    const hashtags = [
      "#Terror",
      "#HorrorShorts",
      "#TerrorTecnologico",
      ...FORMULA_HASHTAGS[story.formula],
      "#Shorts",
    ];

    const hookStrength = Math.max(0, 12 - story.hook.split(/\s+/u).length);
    const twistStrength = story.twistEnding.length < 85 ? 5 : 2;
    const estimatedViralityScore = Math.min(
      99,
      randomInt(72, 88) + hookStrength + twistStrength,
    );

    return {
      title,
      description,
      hashtags,
      estimatedViralityScore,
    };
  }

  private inferTitleDetail(story: StoryDraft, character: string): string {
    const text = `${story.hook} ${story.storyBody} ${story.twistEnding}`.toLowerCase();
    const rules: Array<[string, string]> = [
      ["debajo de su cama", "La sombra bajo la cama"],
      ["antes de nacer", `La foto imposible de ${character}`],
      ["puerta que nadie", "La puerta en la imagen"],
      ["cuenta regresiva", "La cuenta regresiva"],
      ["diez segundos", "Diez segundos adelante"],
      ["frecuencia", `La frecuencia de ${character}`],
      ["copia completa de su mente", `La copia de ${character}`],
      ["cada respuesta", "La respuesta anticipada"],
      ["cerraduras", "El acuerdo nocturno"],
      ["piso inexistente", "El piso que no existe"],
      ["su doble", `El doble de ${character}`],
      ["cámara", `La última grabación de ${character}`],
      ["mamá llame", `La llamada para ${character}`],
      ["cayendo en la trampa", "La trampa de mañana"],
      ["hora exacta", `La hora final de ${character}`],
      ["mensaje", `El aviso para ${character}`],
      ["copia no autorizada", "Identidad no autorizada"],
      ["reconocimiento facial", "El rostro equivocado"],
    ];
    return rules.find(([keyword]) => text.includes(keyword))?.[1] ??
      `El archivo de ${character}`;
  }
}
