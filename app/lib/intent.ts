/**
 * Intent mapping: understand fragments of any kind without forms.
 * User's words are always honored; we only infer category and sentiment for vibe.
 */

export type IntentCategory =
  | "exercise"
  | "food"
  | "mood"
  | "sleep"
  | "work"
  | "social"
  | "hobby"
  | "health"
  | "note";

export type Sentiment = "good" | "neutral" | "low";

export type MappedIntent = {
  category: IntentCategory;
  sentiment: Sentiment;
  summary: string; // always user's words (trimmed/truncated), never forced into a template
};

// Broad keyword sets so many phrasings are recognized
const EXERCISE_WORDS = [
  "gym", "workout", "run", "ran", "exercise", "exercised", "yoga", "swim", "swam",
  "lift", "lifting", "cardio", "cycling", "bike", "biked", "walk", "walked",
  "hike", "hiked", "sport", "training", "stretch", "pilates", "dance", "danced",
  "done", "completed", "finished", "hit the gym",
];
const FOOD_WORDS = [
  "ate", "eat", "eating", "meal", "meals", "food", "breakfast", "lunch", "dinner",
  "snack", "snacked", "water", "drank", "drink", "coffee", "cooked", "cooking",
  "healthy", "junk", "takeout", "restaurant", "recipe", "diet", "fasting",
];
const MOOD_WORDS = [
  "feeling", "feel", "mood", "stress", "stressed", "anxious", "anxiety", "calm",
  "tired", "energy", "good", "bad", "ok", "okay", "great", "fine", "happy", "sad",
  "overwhelmed", "relaxed", "frustrated", "grateful", "lonely", "excited", "bored",
  "motivated", "down", "up", "blah", "meh", "vibes", "mental", "headspace",
];
const SLEEP_WORDS = [
  "sleep", "slept", "rest", "insomnia", "tired", "nap", "napped", "woke",
  "bed", "night", "morning", "overslept", "sleepy",
];
const WORK_WORDS = [
  "work", "worked", "job", "office", "meeting", "meetings", "deadline", "project",
  "focus", "focused", "productive", "productivity", "task", "tasks", "email",
  "career", "interview", "shipped", "launch",
];
const SOCIAL_WORDS = [
  "friend", "friends", "family", "call", "called", "talked", "chat", "hang",
  "party", "date", "visit", "visited", "lonely", "social", "reached out",
];
const HOBBY_WORDS = [
  "read", "reading", "book", "movie", "film", "game", "gaming", "music", "painted",
  "draw", "drawing", "write", "writing", "podcast", "show", "series", "art",
  "hobby", "side project", "learned", "learning",
];
const HEALTH_WORDS = [
  "health", "healthy", "sick", "doctor", "meds", "medicine", "headache", "pain",
  "recovery", "therapy", "meditation", "meditated", "breath", "stretch",
];

const POSITIVE = [
  "good", "great", "done", "healthy", "calm", "happy", "better", "excellent",
  "amazing", "vibes", "productive", "focused", "grateful", "excited", "relaxed",
  "7", "8", "9", "10", "solid", "nice", "love", "loved", "good day", "great day",
];
const NEGATIVE = [
  "bad", "stressed", "anxious", "tired", "low", "sad", "stress", "hard", "rough",
  "overwhelmed", "frustrated", "lonely", "down", "blah", "meh", "sick",
  "1", "2", "3", "4", "5", "6",
];

function normalizeWord(w: string): string {
  return w.replace(/\/10|\.|!|\?|,/g, "").toLowerCase();
}

function getSentiment(text: string): Sentiment {
  const lower = text.toLowerCase().trim();
  const words = lower.split(/\s+|[/,._-]/).map(normalizeWord);
  const hasPositive = words.some((w) => POSITIVE.includes(w));
  const hasNegative = words.some((w) => NEGATIVE.includes(w));
  // Numeric scale: 7+ good, 1-4 low, 5-6 neutral
  const scaleMatch = text.match(/(\d+)\s*\/\s*10|(\d+)\s*out\s*of\s*10/i);
  if (scaleMatch) {
    const n = parseInt(scaleMatch[1] || scaleMatch[2]!, 10);
    if (n >= 8) return "good";
    if (n <= 4) return "low";
  }
  if (hasPositive && !hasNegative) return "good";
  if (hasNegative && !hasPositive) return "low";
  return "neutral";
}

function getCategory(text: string): IntentCategory {
  const lower = text.toLowerCase().trim();
  const words = lower.split(/\s+|[/,._-]/).map(normalizeWord);
  const check = (set: string[]) => words.some((w) => set.includes(w));
  if (check(EXERCISE_WORDS)) return "exercise";
  if (check(FOOD_WORDS)) return "food";
  if (check(MOOD_WORDS)) return "mood";
  if (check(SLEEP_WORDS)) return "sleep";
  if (check(WORK_WORDS)) return "work";
  if (check(SOCIAL_WORDS)) return "social";
  if (check(HOBBY_WORDS)) return "hobby";
  if (check(HEALTH_WORDS)) return "health";
  return "note";
}

/** Always prefer the user's own words; only truncate if very long. */
function getSummary(_category: IntentCategory, text: string): string {
  const t = text.trim();
  const maxLen = 80;
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen - 3) + "...";
}

export function mapIntent(raw: string): MappedIntent {
  const category = getCategory(raw);
  const sentiment = getSentiment(raw);
  const summary = getSummary(category, raw);
  return { category, sentiment, summary };
}
