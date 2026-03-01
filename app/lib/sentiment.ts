import type { Sentiment } from "./intent";

/**
 * HuggingFace twitter-roberta-base-sentiment returns:
 * LABEL_0 = negative, LABEL_1 = neutral, LABEL_2 = positive
 */
export type HFPrediction = Array<
  Array<{ label: string; score: number }>
>;

export function sentimentFromHF(prediction: HFPrediction): Sentiment {
  const scores = prediction[0];
  if (!scores?.length) return "neutral";

  const positive = scores.find((s) => s.label === "LABEL_2")?.score ?? 0;
  const negative = scores.find((s) => s.label === "LABEL_0")?.score ?? 0;

  if (positive > 0.6) return "good";
  if (negative > 0.6) return "low";
  return "neutral";
}

export function getMoodEmoji(prediction: HFPrediction): string {
  const s = sentimentFromHF(prediction);
  if (s === "good") return "☀️";
  if (s === "low") return "🌧️";
  return "☁️";
}
