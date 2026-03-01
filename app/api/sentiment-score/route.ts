import { NextResponse } from "next/server";
import Sentiment from "sentiment";

const analyzer = new Sentiment();

function getSentimentLabel(score: number): "good" | "neutral" | "low" {
  if (score > 0) return "good";
  if (score < 0) return "low";
  return "neutral";
}

/** POST body: { text: string } or { texts: string[] }. Returns { score } or { scores: number[] } and { labels: ("good"|"neutral"|"low")[] }. */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (typeof body.text === "string") {
      const { score } = analyzer.analyze(body.text);
      return NextResponse.json({ score, label: getSentimentLabel(score) });
    }

    if (Array.isArray(body.texts)) {
      const scores = body.texts.map((t: string) => analyzer.analyze(t).score);
      const labels = scores.map(getSentimentLabel);
      return NextResponse.json({ scores, labels });
    }

    return NextResponse.json({ error: "Provide text or texts" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
