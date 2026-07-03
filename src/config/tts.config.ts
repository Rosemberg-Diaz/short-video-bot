import "dotenv/config";

export type TtsProvider = "elevenlabs" | "openai" | "none";

function boolFromEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function numberFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function resolveProvider(): TtsProvider {
  const configured = process.env.TOPS_TTS_PROVIDER?.toLowerCase();
  if (configured === "elevenlabs" || configured === "openai" || configured === "none") {
    return configured;
  }
  if (process.env.ELEVENLABS_API_KEY) return "elevenlabs";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "none";
}

export const ttsConfig = {
  provider: resolveProvider(),
  topsVoiceoverEnabled: boolFromEnv("TOPS_VOICEOVER_ENABLED", true),
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || "",
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM",
  elevenLabsModelId: process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2",
  elevenLabsStability: numberFromEnv("ELEVENLABS_STABILITY", 0.42),
  elevenLabsSimilarityBoost: numberFromEnv("ELEVENLABS_SIMILARITY_BOOST", 0.82),
  elevenLabsStyle: numberFromEnv("ELEVENLABS_STYLE", 0.28),
  openAiApiKey: process.env.OPENAI_API_KEY || "",
  openAiSpeechModel: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
  openAiVoice: process.env.OPENAI_TTS_VOICE || "verse",
};
