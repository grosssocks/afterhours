import { NextResponse } from "next/server";

const EMOJISCRIBE_URL = "https://emojiscribe.vercel.app/api/emoji";

/** POST body: { text: string }. Returns { emoji: string | null } from Emojiscribe's best match. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json({ emoji: null });
    }

    const res = await fetch(EMOJISCRIBE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      return NextResponse.json({ emoji: null });
    }

    const data = (await res.json()) as {
      matches?: Array<{ emoji?: string }>;
    };
    const first = data.matches?.[0]?.emoji ?? null;
    return NextResponse.json({ emoji: first });
  } catch {
    return NextResponse.json({ emoji: null });
  }
}
