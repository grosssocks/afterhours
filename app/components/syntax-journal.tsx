"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mapIntent, type MappedIntent } from "../lib/intent";
import type { Sentiment as SentimentLabel } from "../lib/intent";
import type { Vibe } from "./evolving-background";
import { EvolvingBackground } from "./evolving-background";

async function getSentimentForText(text: string): Promise<SentimentLabel> {
  const res = await fetch("/api/sentiment-score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) return "neutral";
  const data = await res.json();
  return data.label ?? "neutral";
}

async function getSentimentForTexts(texts: string[]): Promise<SentimentLabel[]> {
  if (texts.length === 0) return [];
  const res = await fetch("/api/sentiment-score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts }),
  });
  if (!res.ok) return texts.map(() => "neutral" as SentimentLabel);
  const data = await res.json();
  return data.labels ?? texts.map(() => "neutral" as SentimentLabel);
}

type LogEntry = {
  id: string;
  raw: string;
  intent: MappedIntent;
  at: number;
  archived?: boolean;
};

const STORAGE_KEY = "syntax-daily-log";
const VIBE_OVERRIDE_KEY = "syntax-vibe-override";
const VIBE_WINDOW = 10;

const PLACEHOLDERS = [
  "What’s on your mind?",
  "One line or one word—anything.",
  "Log anything: mood, food, sleep, work…",
  "Type like you’re texting a friend.",
  "How’s the day going?",
  "Quick note, then move on.",
];

function pickResponse(intent: MappedIntent): string {
  const { category, sentiment } = intent;
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  if (sentiment === "good") {
    if (category === "exercise") return pick(["Good to hear.", "Noted. Keep it up.", "That matters."]);
    if (category === "food") return pick(["Noted.", "Good to hear you're eating well.", "Logged."]);
    if (category === "mood") return pick(["Good to hear.", "Glad today's going okay.", "Noted."]);
    if (category === "sleep") return pick(["Hope you rest well.", "Noted.", "Good to hear."]);
    if (category === "work") return pick(["Noted.", "Good to hear.", "That matters."]);
    if (category === "social") return pick(["Good to hear.", "Noted.", "That matters."]);
    if (category === "hobby") return pick(["Noted.", "Good to hear.", "Logged."]);
    if (category === "health") return pick(["Good to hear you're taking care.", "Noted.", "That matters."]);
    return pick(["Noted.", "Good to hear.", "Logged."]);
  }

  if (sentiment === "low") {
    if (category === "mood") return pick(["Thanks for writing it down.", "Noted. Be gentle with yourself.", "Here if you want to log more."]);
    if (category === "sleep") return pick(["Hope you get some rest soon.", "Noted. Rest when you can.", "Thanks for sharing."]);
    if (category === "work") return pick(["That sounds tough. Noted.", "Thanks for writing it down.", "One day at a time."]);
    if (category === "health") return pick(["Hope you feel better soon.", "Noted. Take care.", "Thanks for sharing."]);
    if (category === "social") return pick(["Noted. Reach out when you're ready.", "Thanks for writing it down.", "Here if you want to log more."]);
    return pick(["Thanks for sharing.", "Noted. Be gentle with yourself.", "Here if you want to log more."]);
  }

  if (category === "mood") return pick(["Noted.", "Got it.", "Logged."]);
  return pick(["Noted.", "Logged.", "Got it."]);
}

const VIBES: Vibe[] = ["neutral", "lush", "sunset", "calm", "ocean", "rainy", "night"];

function getVibeFromLogs(entries: LogEntry[]): Vibe {
  const recent = entries.slice(-VIBE_WINDOW);
  if (recent.length === 0) return "neutral";
  const good = recent.filter((e) => e.intent.sentiment === "good").length;
  const low = recent.filter((e) => e.intent.sentiment === "low").length;
  if (good >= 3 && good > low) return "lush";
  if (good >= 1 && good > low) return "sunset";
  if (low >= 3 && low > good) return "night";
  if (low >= 1 && low > good) return "rainy";
  if (good >= 1 && low >= 1) return "ocean";
  if (good >= 1) return "calm";
  return "neutral";
}

const STREAK_CALENDAR_WEEKS = 26;
const STREAK_DAYS = STREAK_CALENDAR_WEEKS * 7;
const CALENDAR_CELL_SIZE = 8;
const CALENDAR_GAP = 2;
const CALENDAR_MONTH_LABEL_WIDTH = 28;
const CALENDAR_COLS = 31;

function getActivityByDay(entries: LogEntry[]): Map<string, number> {
  const byDay = new Map<string, number>();
  for (const e of entries) {
    const key = new Date(e.at).toDateString();
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  return byDay;
}

function getMonthsInRange(start: Date, end: Date): { year: number; month: number; label: string; firstDay: number; lastDay: number }[] {
  const out: { year: number; month: number; label: string; firstDay: number; lastDay: number }[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= endMonth) {
    const year = cur.getFullYear();
    const month = cur.getMonth();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const firstDay = cur.getTime() < start.getTime() ? start.getDate() : 1;
    const lastDay = month === end.getMonth() && year === end.getFullYear()
      ? end.getDate()
      : lastDate;
    out.push({
      year,
      month,
      label: new Date(year, month, 1).toLocaleString("default", { month: "short" }),
      firstDay,
      lastDay,
    });
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

function StreakCalendar({ entries, compact = false }: { entries: LogEntry[]; compact?: boolean }) {
  const activityByDay = getActivityByDay(entries);
  const today = new Date();
  const todayKey = today.toDateString();
  const start = new Date(today);
  start.setDate(start.getDate() - STREAK_DAYS + 1);
  const months = getMonthsInRange(start, today);

  const getLevel = (count: number) => {
    if (count === 0) return 0;
    if (count >= 4) return 4;
    if (count >= 2) return 3;
    return count;
  };

  const size = compact ? CALENDAR_CELL_SIZE : 12;
  const gap = compact ? CALENDAR_GAP : 3;
  const gridWidth =
    CALENDAR_COLS * size + (CALENDAR_COLS - 1) * gap;
  const totalWidth = compact
    ? CALENDAR_MONTH_LABEL_WIDTH + gap + gridWidth
    : undefined;

  return (
    <div
      className={
        compact
          ? "flex flex-col px-3 py-2.5"
          : "w-full max-w-lg"
      }
      style={compact ? { width: totalWidth, minWidth: totalWidth } : undefined}
    >
      {compact && (
        <p
          className="mb-1.5 text-[10px] text-white/40"
          style={{ paddingLeft: CALENDAR_MONTH_LABEL_WIDTH + gap }}
          aria-hidden
        >
          Less ← → More
        </p>
      )}
      <div
        className="flex flex-col overflow-hidden"
        style={{ gap: `${gap}px` }}
        aria-label="Activity calendar by month, last 26 weeks"
      >
        {[...months].reverse().map(({ year, month, label, firstDay, lastDay }) => {
          const dayCount = lastDay - firstDay + 1;
          const padStart = firstDay - 1;
          const padEnd = CALENDAR_COLS - lastDay;
          return (
            <div
              key={`${year}-${month}`}
              className="flex items-center"
              style={{ gap: `${gap}px` }}
            >
              <span
                className="text-[10px] text-white/50 tabular-nums shrink-0 text-right"
                style={{ width: CALENDAR_MONTH_LABEL_WIDTH }}
                aria-hidden
              >
                {label}
              </span>
              <div
                className="grid shrink-0"
                style={{
                  gridTemplateColumns: `repeat(${CALENDAR_COLS}, ${size}px)`,
                  gap: `${gap}px`,
                  width: gridWidth,
                }}
              >
                {Array.from({ length: padStart }, (_, i) => (
                  <div
                    key={`pad-start-${year}-${month}-${i}`}
                    className="rounded-[2px] border border-white/10"
                    style={{ width: size, height: size, backgroundColor: "rgba(255,255,255,0.06)" }}
                    aria-hidden
                  />
                ))}
                {Array.from({ length: dayCount }, (_, i) => {
                  const day = firstDay + i;
                  const d = new Date(year, month, day);
                  const dateKey = d.toDateString();
                  const count = activityByDay.get(dateKey) ?? 0;
                  const isToday = dateKey === todayKey;
                  const level = getLevel(count);
                  return (
                    <div
                      key={dateKey}
                      className="rounded-[2px] border border-white/10"
                      style={{
                        width: size,
                        height: size,
                        backgroundColor:
                          level === 0
                            ? "rgba(255,255,255,0.06)"
                            : level === 1
                              ? "rgba(34, 197, 94, 0.4)"
                              : level === 2
                                ? "rgba(34, 197, 94, 0.6)"
                                : level === 3
                                  ? "rgba(34, 197, 94, 0.8)"
                                  : "rgba(34, 197, 94, 1)",
                        boxShadow: isToday ? "0 0 0 1px rgba(255,255,255,0.5)" : undefined,
                      }}
                      title={`${dateKey}${count > 0 ? ` · ${count} log${count !== 1 ? "s" : ""}` : ""}`}
                    />
                  );
                })}
                {Array.from({ length: padEnd }, (_, i) => (
                  <div
                    key={`pad-end-${year}-${month}-${i}`}
                    className="rounded-[2px] border border-white/10"
                    style={{ width: size, height: size, backgroundColor: "rgba(255,255,255,0.06)" }}
                    aria-hidden
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatTime(at: number): string {
  const d = new Date(at);
  const now = Date.now();
  const diff = now - at;
  if (diff < 60_000) return "just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000 && new Date(now).toDateString() === d.toDateString())
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (diff < 2 * 86400_000) return "yesterday";
  if (diff < 7 * 86400_000) return `${Math.floor(diff / 86400_000)}d ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatDayLabel(at: number): string {
  const d = new Date(at);
  const now = Date.now();
  const today = new Date(now).toDateString();
  const yesterday = new Date(now - 86400_000).toDateString();
  const dStr = d.toDateString();
  if (dStr === today) return "Today";
  if (dStr === yesterday) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function groupEntriesByDay(entries: LogEntry[]): { label: string; dateKey: string; entries: LogEntry[] }[] {
  const byDay = new Map<string, LogEntry[]>();
  for (const e of entries) {
    const key = new Date(e.at).toDateString();
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(e);
  }
  return Array.from(byDay.entries())
    .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
    .map(([dateKey, entries]) => ({
      label: formatDayLabel(entries[0]!.at),
      dateKey,
      entries,
    }));
}

function getTodayStart(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const DAY_END_RAW = "Day ended";

function PixelCat({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      width={48}
      height={48}
      fill="none"
      aria-hidden
    >
      {/* ears */}
      <rect x={2} y={0} width={6} height={8} fill="#374151" />
      <rect x={24} y={0} width={6} height={8} fill="#374151" />
      {/* head */}
      <rect x={4} y={6} width={24} height={20} fill="#6b7280" />
      {/* inner ears */}
      <rect x={4} y={2} width={4} height={6} fill="#9ca3af" />
      <rect x={24} y={2} width={4} height={6} fill="#9ca3af" />
      {/* eyes */}
      <rect x={10} y={12} width={4} height={4} fill="#1f2937" />
      <rect x={18} y={12} width={4} height={4} fill="#1f2937" />
      {/* nose */}
      <rect x={14} y={18} width={4} height={4} fill="#374151" />
      {/* whiskers */}
      <rect x={4} y={16} width={6} height={1} fill="#4b5563" />
      <rect x={4} y={18} width={6} height={1} fill="#4b5563" />
      <rect x={22} y={16} width={6} height={1} fill="#4b5563" />
      <rect x={22} y={18} width={6} height={1} fill="#4b5563" />
      {/* tail - wag */}
      <g className="tail-wag" style={{ transformOrigin: "26px 24px" }}>
        <rect x={26} y={22} width={6} height={4} fill="#6b7280" />
      </g>
    </svg>
  );
}

/** SVG path for mood line: good=high, neutral=middle, low=low (viewBox 0 0 100 100) */
function getMoodPathData(entries: LogEntry[]): string {
  const n = entries.length;
  if (n === 0) return "";
  const yFor = (e: LogEntry): number => {
    if (e.raw === DAY_END_RAW) return 50;
    if (e.intent.sentiment === "good") return 18;
    if (e.intent.sentiment === "low") return 82;
    return 50;
  };
  if (n === 1) return `M 0,50 L 100,${yFor(entries[0]!)}`;
  const pts = entries.map((e, i) => `${(i / (n - 1)) * 100},${yFor(e)}`);
  return `M ${pts.join(" L ")}`;
}

function getMoodAlignSelf(entry: LogEntry): "flex-start" | "center" | "flex-end" {
  if (entry.raw === DAY_END_RAW) return "center";
  if (entry.intent.sentiment === "good") return "flex-start";
  if (entry.intent.sentiment === "low") return "flex-end";
  return "center";
}

/** Correct emoji per category & sentiment. Keyword overrides for specific log text. */
function getEmojiForEntry(entry: LogEntry): string {
  if (entry.raw === DAY_END_RAW) return "\u{1F3C1}"; // 🏁 checkered flag
  const text = `${entry.raw} ${entry.intent.summary}`.toLowerCase();
  if (/\bdead\b/.test(text)) return "\u{26B0}";      // ⚰ coffin
  if (/\bexhausted\b/.test(text)) return "\u{1FAA6}"; // 🪦 grave/tombstone
  if (/\bpizza\b/.test(text)) return "\u{1F355}";   // 🍕 pizza
  const { sentiment, category } = entry.intent;

  if (sentiment === "good") {
    const good: Record<string, string> = {
      exercise: "\u{1F4AA}", // 💪
      food: "\u{1F37D}",     // 🍽
      mood: "\u{2600}",     // ☀️ sun (no VS so stable)
      sleep: "\u{1F319}",   // 🌙 moon
      work: "\u{2705}",     // ✅
      social: "\u{1F4AC}",  // 💬
      hobby: "\u{1F3A8}",   // 🎨
      health: "\u{2764}",   // ❤
      note: "\u{270D}",     // ✍
    };
    return good[category] ?? "\u{2728}"; // ✨
  }

  if (sentiment === "low") {
    const low: Record<string, string> = {
      exercise: "\u{1F4AA}", // 💪 (same, just context)
      food: "\u{1F374}",     // 🍴
      mood: "\u{2601}",      // ☁ cloud
      sleep: "\u{1F319}",    // 🌙
      work: "\u{1F4CA}",     // 📊
      social: "\u{1F464}",   // 👤
      hobby: "\u{1F4DA}",    // 📚
      health: "\u{1F494}",   // 💔
      note: "\u{270D}",      // ✍
    };
    return low[category] ?? "\u{1F494}"; // 💔
  }

  // neutral: category-only so e.g. pizza → food
  const neutral: Record<string, string> = {
    exercise: "\u{1F4AA}",  // 💪
    food: "\u{1F374}",      // 🍴
    mood: "\u{1F4AD}",      // 💭
    sleep: "\u{1F319}",     // 🌙
    work: "\u{1F4BC}",      // 💼
    social: "\u{1F465}",    // 👥
    hobby: "\u{1F3B5}",     // 🎵
    health: "\u{1F49A}",    // 💚
    note: "\u{1F4DD}",      // 📝
  };
  return neutral[category] ?? "\u{1F4DD}"; // 📝
}

function getWeekStart(): number {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function getStats(entries: LogEntry[]) {
  const weekStart = getWeekStart();
  const thisWeek = entries.filter((e) => e.at >= weekStart).length;
  const byCategory: Record<string, number> = {};
  entries.forEach((e) => {
    byCategory[e.intent.category] = (byCategory[e.intent.category] ?? 0) + 1;
  });
  const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { thisWeek, topCategory };
}

function loadLog(): LogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LogEntry[];
    const list = Array.isArray(parsed) ? parsed : [];
    return list.map((e) => ({ ...e, archived: e.archived ?? false }));
  } catch {
    return [];
  }
}

function saveLog(entries: LogEntry[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {}
}

function loadVibeOverride(): Vibe | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(VIBE_OVERRIDE_KEY);
    if (v && VIBES.includes(v as Vibe)) return v as Vibe;
  } catch {}
  return null;
}

export function SyntaxJournal() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [input, setInput] = useState("");
  const [mounted, setMounted] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [vibeOverride, setVibeOverride] = useState<Vibe | null>(null);
  const [shareMenuId, setShareMenuId] = useState<string | null>(null);
  const [archiveView, setArchiveView] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [responseMsg, setResponseMsg] = useState<string | null>(null);
  const [showDayEndCelebration, setShowDayEndCelebration] = useState(false);
  const [dayEndQuote, setDayEndQuote] = useState("");
  const responseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loaded = loadLog();
    setEntries(loaded);
    setVibeOverride(loadVibeOverride());
    setMounted(true);

    if (loaded.length === 0) return;

    const texts = loaded.map((e) => e.raw);
    getSentimentForTexts(texts).then((labels) => {
      setEntries((prev) =>
        prev.length !== labels.length
          ? prev
          : prev.map((e, i) => ({
              ...e,
              intent: { ...e.intent, sentiment: labels[i] ?? "neutral" },
            }))
      );
    });
  }, []);

  useEffect(() => {
    if (!mounted) return;
    saveLog(entries);
  }, [mounted, entries]);

  useEffect(() => {
    if (vibeOverride === null) return;
    try {
      localStorage.setItem(VIBE_OVERRIDE_KEY, vibeOverride);
    } catch {}
  }, [vibeOverride]);

  useEffect(() => {
    const id = setInterval(
      () => setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length),
      4000
    );
    return () => clearInterval(id);
  }, []);

  const autoVibe = getVibeFromLogs(entries);
  const vibe = vibeOverride ?? autoVibe;

  const activeEntries = archiveView
    ? entries.filter((e) => e.archived)
    : entries.filter((e) => !e.archived);
  const displayEntries = activeEntries.slice(-30).reverse();
  const entriesByDay = groupEntriesByDay(displayEntries);
  const archivedCount = entries.filter((e) => e.archived).length;
  const stats = getStats(entries);

  const submit = useCallback(async () => {
    const raw = input.trim();
    if (!raw) return;
    const intent = mapIntent(raw);
    const sentimentLabel = await getSentimentForText(raw);
    const intentWithSentiment = { ...intent, sentiment: sentimentLabel };
    if (editingId) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === editingId ? { ...e, raw, intent: intentWithSentiment, at: e.at } : e
        )
      );
      setEditingId(null);
    } else {
      setEntries((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          raw,
          intent: intentWithSentiment,
          at: Date.now(),
        },
      ]);
      const msg = pickResponse(intentWithSentiment);
      setResponseMsg(msg);
      if (responseTimeoutRef.current) clearTimeout(responseTimeoutRef.current);
      responseTimeoutRef.current = setTimeout(() => {
        setResponseMsg(null);
        responseTimeoutRef.current = null;
      }, 2800);
    }
    setInput("");
  }, [input, editingId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
    if (e.key === "Escape") {
      setEditingId(null);
      setInput("");
    }
  };

  const startEdit = useCallback((entry: LogEntry) => {
    setEditingId(entry.id);
    setInput(entry.raw);
    setShareMenuId(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);


  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        e.preventDefault();
        inputRef.current?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const clearToday = useCallback(() => {
    if (!confirm("Clear all entries from today?")) return;
    const start = getTodayStart();
    setEntries((prev) => prev.filter((e) => e.at < start));
    setMenuOpen(false);
  }, []);

  const startFresh = useCallback(() => {
    if (
      !confirm(
        "Start fresh? All your logs will be deleted. Download a moodboard from the menu first if you want to keep a copy."
      )
    )
      return;
    setEntries([]);
    setVibeOverride(null);
    try {
      localStorage.removeItem(VIBE_OVERRIDE_KEY);
    } catch {}
    setMenuOpen(false);
  }, []);

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const todayEntries = entries.filter((e) => !e.archived && e.at >= getTodayStart());
  const todayEnded = todayEntries.some((e) => e.raw === DAY_END_RAW);

  const HAPPY_QUOTES = [
    "You showed up today. That counts.",
    "Rest well. Tomorrow is a new route.",
    "One day down. You did it.",
    "The best way to predict the future is to create it.",
    "Small steps still move you forward.",
    "Today was enough. Be kind to yourself.",
    "You navigated today. Rest now.",
    "Every day you log is a day you cared.",
    "Tomorrow is a fresh start.",
    "You made it through today. That matters.",
  ];

  const endDay = useCallback(() => {
    const todayStart = getTodayStart();
    if (!todayEnded) {
      const intent = mapIntent(DAY_END_RAW);
      setEntries((prev) => {
        const withDayEnd = [
          ...prev,
          {
            id: `day-end-${Date.now()}`,
            raw: DAY_END_RAW,
            intent,
            at: Date.now(),
          },
        ];
        return withDayEnd.map((e) =>
          e.at >= todayStart ? { ...e, archived: true } : e
        );
      });
    } else {
      setEntries((prev) =>
        prev.map((e) => (e.at >= todayStart ? { ...e, archived: true } : e))
      );
    }
    setDayEndQuote(HAPPY_QUOTES[Math.floor(Math.random() * HAPPY_QUOTES.length)] ?? HAPPY_QUOTES[0]!);
    setShowDayEndCelebration(true);
  }, [todayEnded]);

  const dismissCelebration = useCallback(() => {
    setShowDayEndCelebration(false);
  }, []);

  useEffect(() => {
    if (!showDayEndCelebration) return;
    const t = setTimeout(dismissCelebration, 6000);
    return () => clearTimeout(t);
  }, [showDayEndCelebration, dismissCelebration]);

  const archiveEntry = useCallback((id: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, archived: true } : e))
    );
  }, []);

  const unarchiveEntry = useCallback((id: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, archived: false } : e))
    );
  }, []);

  const openShareMenu = useCallback((entry: LogEntry) => {
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator
        .share({ title: "From after hours", text: entry.raw })
        .then(() => setShareMenuId(null))
        .catch((err: Error) => {
          if (err.name !== "AbortError") setShareMenuId(entry.id);
        });
    } else {
      setShareMenuId(entry.id);
    }
  }, []);

  const shareWith = useCallback(
    async (entry: LogEntry, method: "copy" | "twitter" | "whatsapp") => {
      const shareText = entry.raw;
      const encoded = encodeURIComponent(shareText);
      if (method === "twitter") {
        window.open(`https://twitter.com/intent/tweet?text=${encoded}`, "_blank", "noopener,noreferrer");
      } else if (method === "whatsapp") {
        window.open(`https://wa.me/?text=${encoded}`, "_blank", "noopener,noreferrer");
      } else {
        try {
          await navigator.clipboard.writeText(shareText);
          if (typeof window !== "undefined") alert("Copied to clipboard!");
        } catch {
          if (typeof window !== "undefined") alert("Couldn’t copy.");
        }
      }
      setShareMenuId(null);
    },
    []
  );

  const downloadMoodboardPng = useCallback(() => {
    const W = 640;
    const H = 800;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      alert("Could not create image.");
      setMenuOpen(false);
      return;
    }
    const bg = "#0f0f12";
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const gradient = ctx.createLinearGradient(0, 0, W, H);
    gradient.addColorStop(0, "rgba(255,255,255,0.06)");
    gradient.addColorStop(1, "rgba(255,255,255,0.02)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    let y = 48;
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "600 28px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("after hours", W / 2, y);
    y += 36;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillText(`Your route · ${new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })}`, W / 2, y);
    y += 44;

    const sorted = [...entries].sort((a, b) => a.at - b.at);
    const byDay = groupEntriesByDay(sorted.filter((e) => !e.archived));
    const pad = 24;
    const lineH = 22;
    ctx.textAlign = "left";

    byDay.slice(0, 14).forEach(({ label, entries: dayEntries }) => {
      if (y > H - 80) return;
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "600 13px system-ui, sans-serif";
      ctx.fillText(label, pad, y);
      y += lineH + 4;
      dayEntries.slice(0, 8).forEach((entry) => {
        if (y > H - 60) return;
        const isEnd = entry.raw === DAY_END_RAW;
        if (isEnd) {
          ctx.fillStyle = "rgba(255,255,255,0.5)";
        } else if (entry.intent.sentiment === "good") {
          ctx.fillStyle = "rgba(134, 239, 172, 0.9)";
        } else if (entry.intent.sentiment === "low") {
          ctx.fillStyle = "rgba(252, 165, 165, 0.9)";
        } else {
          ctx.fillStyle = "rgba(255,255,255,0.85)";
        }
        ctx.font = "13px system-ui, sans-serif";
        const text = (isEnd ? "Day ended" : entry.intent.summary).slice(0, 52);
        ctx.fillText(text, pad + 8, y);
        y += lineH;
      });
      y += 16;
    });

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          alert("Could not create image.");
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `moodboard-${new Date().toISOString().slice(0, 10)}.png`;
        a.click();
        URL.revokeObjectURL(url);
      },
      "image/png",
      0.92
    );
    setMenuOpen(false);
  }, [entries]);

  return (
    <>
      {showDayEndCelebration && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[#0f0f12]/98 px-4 py-6 backdrop-blur-sm sm:gap-8 sm:py-8"
          style={{
            paddingTop: "max(1.5rem, env(safe-area-inset-top))",
            paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
            paddingLeft: "max(1rem, env(safe-area-inset-left))",
            paddingRight: "max(1rem, env(safe-area-inset-right))",
          }}
          role="dialog"
          aria-label="Day complete"
          onClick={dismissCelebration}
        >
          <div className="pixel-cat-dance-wrap">
            <PixelCat className="pixel-cat-svg" />
          </div>
          <p className="max-w-sm text-center text-lg font-medium leading-snug text-white">
            {dayEndQuote}
          </p>
          <p className="text-sm text-white/50">Tap anywhere to continue</p>
        </div>
      )}
      <EvolvingBackground vibe={vibe} />
      <div className="relative z-10 flex flex-col">
        <div className="page-container mx-auto w-full max-w-4xl min-w-0 px-4 pb-8 pt-4 sm:px-6 sm:pb-10 sm:pt-6 md:px-12 md:pb-14 md:pt-10 lg:px-16 lg:pb-16 lg:pt-14">
          <header className="flex flex-col gap-4 border-b border-white/10 pb-4 pt-0 sm:pb-6 md:gap-5 md:pb-10 md:pt-0 lg:gap-6 lg:pb-12 lg:pt-0" style={{ paddingTop: "max(0px, env(safe-area-inset-top))" }}>
            {/* Row 1: after hours left, hamburger right */}
            <div className="flex min-w-0 items-center justify-between gap-2 min-[360px]:gap-3">
              <div className="min-w-0 flex-1 text-left">
                <h1 className="truncate text-lg font-semibold tracking-tight text-white min-[375px]:text-xl sm:text-2xl md:text-4xl md:font-bold lg:text-5xl">
                  after hours
                </h1>
                <p className="mt-0.5 truncate text-[11px] text-white/55 min-[375px]:text-xs sm:mt-1 sm:text-sm md:mt-2 md:text-base lg:text-lg">Navigate your day. Log your route.</p>
              </div>
              <div className="relative shrink-0">
              <div className="flex flex-col items-end gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white/80 shadow-sm transition-colors hover:bg-white/10 hover:text-white min-[768px]:h-9 min-[768px]:w-9"
                  aria-expanded={menuOpen}
                  aria-haspopup="true"
                  aria-label="Menu"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => setCalendarOpen((o) => !o)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white min-[768px]:h-9 min-[768px]:w-9"
                    aria-label="Show activity calendar"
                    aria-expanded={calendarOpen}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                  </button>
                  <div className={`absolute right-0 top-full z-40 mt-2 max-h-[min(80vh,400px)] max-w-[min(100vw-2rem,340px)] overflow-auto transition-all duration-150 ${calendarOpen ? "opacity-100 visible pointer-events-auto" : "opacity-0 invisible pointer-events-none group-hover:opacity-100 group-hover:visible group-hover:pointer-events-auto"}`}>
                    <div className="rounded-xl border border-white/15 bg-black/95 p-2 sm:p-2.5 shadow-xl">
                      <div className="rounded-lg border border-white/10 bg-black/30 overflow-hidden">
                        <StreakCalendar entries={entries} compact />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    aria-hidden
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-30 mt-1 w-52 min-w-[14rem] max-w-[min(100vw-2rem,20rem)] rounded-xl border border-white/15 bg-black/90 py-2 shadow-xl backdrop-blur-sm overflow-visible">
                    <div className="border-b border-white/10 px-3 pb-2 mb-2">
                      <p className="text-xs font-medium uppercase tracking-wider text-white/40">
                        Background
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {VIBES.map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => {
                              setVibeOverride((prev) => (prev === v ? null : v));
                            }}
                            className={`rounded px-2 py-1 text-xs capitalize ${
                              vibe === v
                                ? "bg-white/20 text-white"
                                : "bg-white/10 text-white/70 hover:bg-white/15"
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1 text-[10px] text-white/40">
                        {vibeOverride ? "Override on" : "Auto from log"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={downloadMoodboardPng}
                      className="block w-full min-h-[44px] px-3 py-3 text-left text-sm text-white/80 hover:bg-white/10 sm:py-1.5"
                    >
                      Download moodboard (PNG)
                    </button>
                    <button
                      type="button"
                      onClick={clearToday}
                      className="block w-full min-h-[44px] px-3 py-3 text-left text-sm text-white/80 hover:bg-white/10 sm:py-1.5"
                    >
                      Clear today
                    </button>
                    <button
                      type="button"
                      onClick={startFresh}
                      className="block w-full min-h-[44px] px-3 py-3 text-left text-sm text-rose-300/90 hover:bg-white/10 sm:py-1.5"
                    >
                      Start fresh (delete all logs)
                    </button>
                  </div>
                </>
              )}
              </div>
            </div>
          </header>

          <main className="flex flex-col items-center px-0 pb-20 sm:pb-24 md:px-6 md:pb-32 lg:px-8 lg:pb-36" style={{ paddingBottom: "max(5rem, env(safe-area-inset-bottom, 0px))" }}>
            <p className="mb-6 mt-6 max-w-lg px-2 text-center text-sm leading-relaxed text-white/50 sm:mb-8 sm:mt-8 md:mb-12 md:mt-12 md:max-w-xl md:text-base md:leading-loose lg:mb-14 lg:mt-14 lg:text-lg">
              Drop a pin. Log mood, meals, sleep, or anything—your path updates as you go.
            </p>

            <div className="w-full max-w-lg min-w-0 md:max-w-xl">
            <div className="flex min-w-0 gap-2 sm:gap-3 md:gap-4">
              <div className={`min-w-0 flex-1 rounded-xl border shadow-lg backdrop-blur-sm transition-colors sm:rounded-2xl md:rounded-2xl ${editingId ? "border-amber-500/50 bg-amber-500/10" : "border-white/15 bg-white/5 hover:border-white/20"}`}>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={editingId ? "Edit and press Enter to save, Esc to cancel" : PLACEHOLDERS[placeholderIndex]}
                  className="w-full min-w-0 rounded-xl bg-transparent px-4 py-3 text-base text-white placeholder:text-white/40 focus:outline-none focus:ring-0 sm:rounded-2xl sm:px-5 sm:py-4 md:px-6 md:py-5 md:text-lg lg:py-6 lg:text-xl"
                  autoFocus
                />
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-white/35 md:mt-4 md:text-sm">
              {editingId ? "Enter to save · Esc to cancel" : "Enter to log · / or Cmd+K to focus"}
            </p>
            {responseMsg && (
              <p
                className="response-msg mt-2 text-center text-sm text-white/70"
                role="status"
                aria-live="polite"
              >
                {responseMsg}
              </p>
            )}
          </div>

          {entries.length > 0 && (
            <div className="mt-8 w-full max-w-lg min-w-0 sm:mt-12 md:mt-14 md:max-w-xl lg:mt-16">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 sm:gap-3 md:mb-6">
                <p className="text-xs font-medium uppercase tracking-wider text-white/45 md:text-sm">
                  {archiveView ? "Archive" : "Your route"}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/10 px-3 py-2 text-xs text-white/70 min-h-[44px] min-[768px]:min-h-0 min-[768px]:py-1.5 inline-flex items-center">
                    {stats.thisWeek} this week
                  </span>
                  <button
                    type="button"
                    onClick={() => setArchiveView((v) => !v)}
                    className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 min-h-[44px] text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white min-[768px]:min-h-0"
                    aria-label={archiveView ? "Back to log" : "View archive"}
                  >
                    {archiveView ? "Back to log" : `Archive${archivedCount > 0 ? ` (${archivedCount})` : ""}`}
                  </button>
                </div>
              </div>
              <div className="space-y-8">
                {entriesByDay.map(({ label, dateKey, entries: dayEntries }) => {
                  const isToday = label === "Today";
                  const showEndDay = isToday && !archiveView;
                  const dayChrono = [...dayEntries].reverse();
                  return (
                  <section key={dateKey} className="log-path-day rounded-xl border border-white/10 bg-white/[0.03] p-3 shadow-sm sm:rounded-2xl sm:p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-medium uppercase tracking-wider text-white/50">
                        {label}
                      </h3>
                      {showEndDay && (
                        <button
                          type="button"
                          onClick={endDay}
                          className="rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 min-h-[44px] text-xs font-medium text-white/85 transition-colors hover:bg-white/15 hover:text-white min-[768px]:min-h-0 min-[768px]:py-2"
                        >
                          End day
                        </button>
                      )}
                      {isToday && !archiveView && todayEnded && (
                        <span className="text-[10px] uppercase tracking-wider text-white/45">
                          Day ended
                        </span>
                      )}
                    </div>
                    <ul className="log-path-h flex flex-nowrap items-center gap-x-3 overflow-x-auto pb-2 pt-1 sm:gap-x-4">
                      <svg
                        className="log-path-mood absolute left-0 top-0 h-full w-full overflow-visible"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        aria-hidden
                      >
                        <path
                          d={getMoodPathData(dayChrono)}
                          fill="none"
                          stroke="rgba(255,255,255,0.35)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                      {dayChrono.map((entry, i) => (
                        <li
                          key={entry.id}
                          className="group/path flex shrink-0 items-center gap-4"
                          style={{ alignSelf: getMoodAlignSelf(entry) }}
                        >
                          <span
                            className={`path-node flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-[var(--color-background)] text-base ${entry.raw === DAY_END_RAW ? "border-2 border-white/40 ring-2 ring-white/10" : "border border-white/25"}`}
                            aria-hidden
                          >
                            {getEmojiForEntry(entry)}
                          </span>
                          <article className="path-log min-w-0 shrink-0 border-l border-white/15 pl-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="max-w-[140px] truncate text-sm text-white/95 min-[400px]:max-w-[180px] sm:max-w-[240px]">
                                {entry.intent.summary}
                              </span>
                              <time className="shrink-0 text-[10px] text-white/35" dateTime={new Date(entry.at).toISOString()}>
                                {formatTime(entry.at)}
                              </time>
                            </div>
                            <div className="mt-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/path:opacity-100">
                              <button
                                type="button"
                                onClick={() => startEdit(entry)}
                                className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white/70"
                                aria-label="Edit"
                              >
                                <PencilIcon />
                              </button>
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => openShareMenu(entry)}
                                  className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white/70"
                                  aria-label="Share"
                                  aria-expanded={shareMenuId === entry.id}
                                >
                                  <ShareIcon />
                                </button>
                                {shareMenuId === entry.id && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-40"
                                      aria-hidden
                                      onClick={() => setShareMenuId(null)}
                                    />
                                    <div className="absolute left-0 top-full z-50 mt-1 min-w-[120px] rounded-xl border border-white/15 bg-black/95 py-1 shadow-xl backdrop-blur-md">
                                      <button
                                        type="button"
                                        onClick={() => shareWith(entry, "copy")}
                                        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs text-white/90 hover:bg-white/10"
                                      >
                                        <CopyIcon /> Copy
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => shareWith(entry, "twitter")}
                                        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs text-white/90 hover:bg-white/10"
                                      >
                                        <TwitterIcon /> Twitter
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => shareWith(entry, "whatsapp")}
                                        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs text-white/90 hover:bg-white/10"
                                      >
                                        <WhatsAppIcon /> WhatsApp
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                              {archiveView ? (
                                <button
                                  type="button"
                                  onClick={() => unarchiveEntry(entry.id)}
                                  className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white/70"
                                  aria-label="Restore"
                                >
                                  <ArchiveRestoreIcon />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => archiveEntry(entry.id)}
                                  className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white/70"
                                  aria-label="Archive"
                                >
                                  <ArchiveIcon />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => deleteEntry(entry.id)}
                                className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-rose-300/70"
                                aria-label="Delete"
                              >
                                <TrashIcon />
                              </button>
                            </div>
                          </article>
                        </li>
                      ))}
                    </ul>
                  </section>
                  );
                })}
              </div>
            </div>
          )}
        </main>

        <footer className="mt-auto border-t border-white/10 py-8 text-center">
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm font-medium tracking-wide text-white/90 sm:text-base">
              Real Time Emotion Tracking. Zero Judgment
            </p>
            <p className="bg-gradient-to-r from-cyan-300 via-violet-300 to-pink-300 bg-clip-text text-xs font-normal text-transparent sm:text-sm">
              a tiny internet experiment by{" "}
              <span className="group relative inline-block">
                <a
                  href="https://github.com/foggyhead"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gradient-to-r from-cyan-300 via-violet-300 to-pink-300 bg-clip-text text-transparent hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-[#0f0f12] rounded"
                  aria-label="Harsha's GitHub @foggyhead"
                >
                  harsha
                </a>
                <span className="credits-bubble absolute bottom-full left-1/2 z-50 mb-1 hidden -translate-x-1/2 whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:block group-hover:opacity-100" aria-hidden>
                  <span className="block rounded-lg border border-white/20 bg-zinc-800/95 px-3 py-2 shadow-lg backdrop-blur-sm">
                    <span className="text-cyan-300">@foggyhead</span>
                  </span>
                  <span className="credits-arrow absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-[6px] border-transparent border-t-zinc-800" aria-hidden style={{ filter: "drop-shadow(0 1px 0 rgba(255,255,255,0.1))" }} />
                </span>
              </span>
              {" & "}
              <span className="group relative inline-block">
                <a
                  href="https://github.com/grosssocks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gradient-to-r from-cyan-300 via-violet-300 to-pink-300 bg-clip-text text-transparent hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-[#0f0f12] rounded"
                  aria-label="Sujita's GitHub @grosssocks"
                >
                  sujita
                </a>
                <span className="credits-bubble absolute bottom-full left-1/2 z-50 mb-1 hidden -translate-x-1/2 whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:block group-hover:opacity-100" aria-hidden>
                  <span className="block rounded-lg border border-white/20 bg-zinc-800/95 px-3 py-2 shadow-lg backdrop-blur-sm">
                    <span className="text-pink-300">@grosssocks</span>
                  </span>
                  <span className="credits-arrow absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-[6px] border-transparent border-t-zinc-800" aria-hidden style={{ filter: "drop-shadow(0 1px 0 rgba(255,255,255,0.1))" }} />
                </span>
              </span>
            </p>
            <p className="text-xs text-white/50 sm:text-sm">
              © {new Date().getFullYear()}
            </p>
          </div>
          <div className="footer-cart-track mt-4 w-full overflow-hidden" aria-hidden>
            <div className="footer-cart-walk">
              <img
                src="/girl-driving-billy-cart.png"
                alt=""
                className="footer-cart-bob h-14 w-auto object-contain object-bottom sm:h-16 md:h-20"
                width={120}
                height={80}
              />
            </div>
          </div>
        </footer>
        </div>
      </div>
    </>
  );
}

function PencilIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );
}

function ArchiveRestoreIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
    </svg>
  );
}

function TwitterIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
