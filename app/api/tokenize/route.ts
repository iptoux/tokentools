import { NextRequest, NextResponse } from "next/server";
import { get_encoding } from "@dqbd/tiktoken";

export const runtime = "nodejs";

type Token = {
  id: number;
  text: string;
};

type TokenizeRequestBody = {
  model: string;
  texts: Record<string, string | undefined>;
};

type TokenizeResponseBody = {
  model: string;
  tokens: Record<string, Token[]>;
};

export async function POST(req: NextRequest) {
  let body: TokenizeRequestBody;

  try {
    body = (await req.json()) as TokenizeRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { model, texts } = body;

  if (!model || typeof model !== "string") {
    return NextResponse.json({ error: "Missing or invalid model" }, { status: 400 });
  }

  if (!texts || typeof texts !== "object") {
    return NextResponse.json({ error: "Missing or invalid texts" }, { status: 400 });
  }

  // For now we only support cl100k_base; other models can be added later.
  if (model !== "cl100k_base") {
    return NextResponse.json({ error: `Unsupported model: ${model}` }, { status: 400 });
  }

  const encoding = get_encoding("cl100k_base");
  const decoder = new TextDecoder();

  const resultTokens: Record<string, Token[]> = {};

  try {
    for (const [key, text] of Object.entries(texts)) {
      if (!text) {
        resultTokens[key] = [];
        continue;
      }

      const ids = encoding.encode(text);
      const tokens: Token[] = ids.map((id) => {
        const bytes = encoding.decode_single_token_bytes(id);
        const tokenText = decoder.decode(bytes);
        return { id, text: tokenText };
      });

      resultTokens[key] = tokens;
    }
  } catch (err) {
    encoding.free();
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Tokenization failed",
      },
      { status: 500 }
    );
  }

  encoding.free();

  const response: TokenizeResponseBody = {
    model,
    tokens: resultTokens,
  };

  return NextResponse.json(response);
}

