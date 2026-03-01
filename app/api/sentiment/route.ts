import { NextResponse } from "next/server";

/** HuggingFace twitter-roberta-base-sentiment. LABEL_0=negative, LABEL_1=neutral, LABEL_2=positive. */
export async function POST(req: Request) {
  const { text } = await req.json();

  const response = await fetch(
    "https://api-inference.huggingface.co/models/cardiffnlp/twitter-roberta-base-sentiment",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text }),
    }
  );

  const result = await response.json();

  return NextResponse.json(result);
}
