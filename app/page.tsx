'use client';

import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import { Badge } from "@/components/ui/badge";

type EncodingFormat = "base64" | "hex" | "url-safe";

type Counts = {
  chars: number;
  bytes: number;
};

type TokenCounts = Counts & {
  tokens: number;
};

type Token = {
  id: number;
  text: string;
};

function calculateCounts(value: string): Counts {
  if (!value) {
    return { chars: 0, bytes: 0 };
  }

  const chars = value.length;
  const bytes = typeof window === "undefined" ? chars : new TextEncoder().encode(value).length;

  return { chars, bytes };
}

function approximateTokensFromText(text: string): number {
  if (!text) return 0;
  const bytes = typeof window === "undefined" ? text.length : new TextEncoder().encode(text).length;

  // Very simple heuristic: tokens roughly equal bytes / 4 (approx for English/BPE tokens).
  // This is intentionally approximate — it gives a helpful comparison across formats
  // for the purpose of this tool without introducing a dependency on a tokenizer.
  return Math.max(1, Math.ceil(bytes / 4));
}

function simpleTokenize(text: string) {
  if (!text) return [];

  // Fallback, approximate tokenizer: splits on whitespace and punctuation but preserves tokens and positions.
  const regex = /\s+|[A-Za-z0-9_\-"'@]+|[^\sA-Za-z0-9_\-"'@]+/g;
  const tokens: { id: number | null; text: string; start: number; end: number }[] = [];

  const idMap = new Map<string, number>();
  let nextId = 1;

  let m: RegExpExecArray | null;
  while ((m = regex.exec(text))) {
    const tokenText = m[0];
    if (/^\s+$/.test(tokenText)) {
      tokens.push({ id: null, text: tokenText, start: m.index, end: m.index + tokenText.length });
      continue;
    }

    if (!idMap.has(tokenText)) idMap.set(tokenText, nextId++);

    tokens.push({ id: idMap.get(tokenText) ?? null, text: tokenText, start: m.index, end: m.index + tokenText.length });
  }

  return tokens;
}

function colorForTokenId(id?: number | null) {
  if (!id) return "transparent";
  const hue = (id * 47) % 360;
  return `hsla(${hue} 90% 45% / 0.2)`;
}

function RenderHighlighted({ tokens }: { tokens: { id: number | null; text: string }[] }) {
  return (
    <>
      {tokens.map((t, i) =>
        t.id ? (
          <span
            key={i}
            style={{ backgroundColor: colorForTokenId(t.id), borderRadius: 4 }}
            className="px-[2px] py-[1px]"
          >
            {t.text}
          </span>
        ) : (
          <span key={i}>{t.text}</span>
        )
      )}
    </>
  );
}

function jsonToYamlLite(value: unknown, indent = 0): string {
  const space = "  ".repeat(indent);

  if (value === null || typeof value !== "object") {
    if (typeof value === "string") {
      return JSON.stringify(value);
    }
    return String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }

    return value
      .map((item) => {
        const nested = jsonToYamlLite(item, indent + 1);
        if (typeof item === "object" && item !== null && nested.includes("\n")) {
          return `${space}- ${nested.split("\n")[0]}\n${nested
            .split("\n")
            .slice(1)
            .map((line) => `${"  "}${line}`)
            .join("\n")}`;
        }

        return `${space}- ${nested}`;
      })
      .join("\n");
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    return "{}";
  }

  return entries
    .map(([key, val]) => {
      const nested = jsonToYamlLite(val, indent + 1);
      if (val !== null && typeof val === "object") {
        return `${space}${key}:\n${"  ".repeat(indent + 1)}${nested.replace(/\n/g, `\n${"  ".repeat(indent + 1)}`)}`;
      }

      return `${space}${key}: ${nested}`;
    })
    .join("\n");
}

function encodeWithFormat(input: string, format: EncodingFormat): string {
  switch (format) {
    case "hex": {
      return Array.from(input)
        .map((ch) => ch.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("");
    }
    case "url-safe": {
      return encodeURIComponent(input);
    }
    case "base64":
    default: {
      if (typeof window === "undefined") {
        return Buffer.from(input, "utf-8").toString("base64");
      }

      return typeof btoa === "function" ? btoa(unescape(encodeURIComponent(input))) : input;
    }
  }
}

import { encode as encodeToon } from "@toon-format/toon";

/**
 * Encode parsed JSON as TOON using the official library.
 */
function toToonEncoding(parsed: unknown, delimiter: "," | "\t" | "|" = ",", keyFolding: "off" | "safe" = "off") {
  try {
    const encoded = encodeToon(parsed, { delimiter, keyFolding });
    return encoded || "";
  } catch (err) {
    // Fallback to an empty string on error so the UI shows a parse error instead
    return "";
  }
}

export default function Home() {
  const [input, setInput] = useState<string>('{"hello": "world"}');
  const [encodingFormat, setEncodingFormat] = useState<EncodingFormat>("base64");
  const [encodingStrength, setEncodingStrength] = useState<number>(2);
  const [showCounts, setShowCounts] = useState<boolean>(true);
  const [toonDelimiter, setToonDelimiter] = useState<"," | "\t" | "|">(",");
  const [toonKeyFolding, setToonKeyFolding] = useState<'off' | 'safe'>('off');
  const [showTokens, setShowTokens] = useState<boolean>(false);
  const [tokenizationModel, setTokenizationModel] = useState<string>("cl100k_base");
  const [tokenViewPerTab, setTokenViewPerTab] = useState<Record<string, "text" | "ids">>({
    pretty: "text",
    minified: "text",
    yaml: "text",
    toon: "text",
  });
  const [exactTokens, setExactTokens] = useState<Record<string, Token[]>>({});
  const [isTokenizing, setIsTokenizing] = useState<boolean>(false);
  const [tokenizeError, setTokenizeError] = useState<string>("");

  const { error, prettyJson, minifiedJson, yaml, toon } = useMemo(() => {
    if (!input.trim()) {
      return {
        error: "",
        prettyJson: "",
        minifiedJson: "",
        yaml: "",
        toon: "",
      };
    }

    try {
      const parsed = JSON.parse(input);
      const pretty = JSON.stringify(parsed, null, 2);
      const minified = JSON.stringify(parsed);
      const yamlText = jsonToYamlLite(parsed);

      const toonText = toToonEncoding(parsed, toonDelimiter, toonKeyFolding);

      return {
        error: "",
        prettyJson: pretty,
        minifiedJson: minified,
        yaml: yamlText,
        toon: toonText,
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Invalid JSON",
        prettyJson: "",
        minifiedJson: "",
        yaml: "",
        toon: "",
      };
    }
  }, [input, encodingFormat, encodingStrength]);

  const prettyCounts = calculateCounts(prettyJson);
  const minifiedCounts = calculateCounts(minifiedJson);
  const yamlCounts = calculateCounts(yaml);
  const toonCounts = calculateCounts(toon);

  const prettyTokenCount = approximateTokensFromText(prettyJson);
  const minifiedTokenCount = approximateTokensFromText(minifiedJson);
  const yamlTokenCount = approximateTokensFromText(yaml);
  // For toon we can be more precise: tokens are the chunked groups in the toon output
  const toonTokenCount = toon ? simpleTokenize(toon).filter((t) => t.id || t.text.trim()).length : 0;

  const prettyTokenCounts: TokenCounts = { ...prettyCounts, tokens: prettyTokenCount };
  const minifiedTokenCounts: TokenCounts = { ...minifiedCounts, tokens: minifiedTokenCount };
  const yamlTokenCounts: TokenCounts = { ...yamlCounts, tokens: yamlTokenCount };
  const toonTokenCounts: TokenCounts = { ...toonCounts, tokens: toonTokenCount };

  useEffect(() => {
    if (tokenizationModel !== "cl100k_base") {
      setExactTokens({});
      setIsTokenizing(false);
      setTokenizeError("");
      return;
    }

    // Only compute exact tokenization when needed.
    if (!showTokens && !showCounts) {
      setExactTokens({});
      setIsTokenizing(false);
      setTokenizeError("");
      return;
    }

    const texts = {
      pretty: prettyJson,
      minified: minifiedJson,
      yaml,
      toon,
    };

    if (!texts.pretty && !texts.minified && !texts.yaml && !texts.toon) {
      setExactTokens({});
      setIsTokenizing(false);
      setTokenizeError("");
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const run = async () => {
      try {
        setIsTokenizing(true);
        setTokenizeError("");

        const res = await fetch("/api/tokenize", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model: tokenizationModel, texts }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as { error?: string };
          if (!cancelled) {
            setExactTokens({});
            setTokenizeError(payload.error || "Failed to tokenize");
          }
          return;
        }

        const payload = (await res.json()) as { tokens?: Record<string, Token[]> };
        if (!cancelled) {
          setExactTokens(payload.tokens ?? {});
        }
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === "AbortError")) return;
        setExactTokens({});
        setTokenizeError(err instanceof Error ? err.message : "Failed to tokenize");
      } finally {
        if (!cancelled) {
          setIsTokenizing(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [prettyJson, minifiedJson, yaml, toon, tokenizationModel, showTokens, showCounts]);

  // tokenized breakdown for highlighting / ids — computed lazily when tokens are enabled
  const prettyTokens =
    showTokens && tokenizationModel === "cl100k_base" && exactTokens.pretty
      ? (exactTokens.pretty as any)
      : showTokens
        ? simpleTokenize(prettyJson)
        : undefined;
  const minifiedTokens =
    showTokens && tokenizationModel === "cl100k_base" && exactTokens.minified
      ? (exactTokens.minified as any)
      : showTokens
        ? simpleTokenize(minifiedJson)
        : undefined;
  const yamlTokens =
    showTokens && tokenizationModel === "cl100k_base" && exactTokens.yaml
      ? (exactTokens.yaml as any)
      : showTokens
        ? simpleTokenize(yaml)
        : undefined;
  const toonTokens =
    showTokens && tokenizationModel === "cl100k_base" && exactTokens.toon
      ? (exactTokens.toon as any)
      : showTokens
        ? toon
          ? simpleTokenize(toon).map((t) => ({ id: t.id ?? undefined, text: t.text }))
          : []
        : undefined;

  if (showTokens) {
    if (prettyTokens) prettyTokenCounts.tokens = prettyTokens.filter((t) => t.id).length;
    if (minifiedTokens) minifiedTokenCounts.tokens = (minifiedTokens as any[]).filter((t) => t.id).length;
    if (yamlTokens) yamlTokenCounts.tokens = (yamlTokens as any[]).filter((t) => t.id).length;
    if (toonTokens) toonTokenCounts.tokens = (toonTokens as any[]).length;
  }

  if (tokenizationModel === "cl100k_base") {
    if (exactTokens.pretty && exactTokens.pretty.length > 0) {
      prettyTokenCounts.tokens = exactTokens.pretty.length;
    }
    if (exactTokens.minified && exactTokens.minified.length > 0) {
      minifiedTokenCounts.tokens = exactTokens.minified.length;
    }
    if (exactTokens.yaml && exactTokens.yaml.length > 0) {
      yamlTokenCounts.tokens = exactTokens.yaml.length;
    }
    if (exactTokens.toon && exactTokens.toon.length > 0) {
      toonTokenCounts.tokens = exactTokens.toon.length;
    }
  }

  const getTokenIdsFor = (kind: "pretty" | "minified" | "yaml" | "toon"): number[] => {
    let tokens: any[] | undefined;

    if (tokenizationModel === "cl100k_base" && exactTokens[kind]) {
      tokens = exactTokens[kind] as any[];
    } else {
      switch (kind) {
        case "pretty":
          tokens = (prettyTokens as any[]) || [];
          break;
        case "minified":
          tokens = (minifiedTokens as any[]) || [];
          break;
        case "yaml":
          tokens = (yamlTokens as any[]) || [];
          break;
        case "toon":
          tokens = (toonTokens as any[]) || [];
          break;
      }
    }

    if (!tokens) return [];

    return tokens
      .map((t) => (typeof t.id === "number" ? t.id : null))
      .filter((id): id is number => id !== null);
  };

  const handleCopyTokenIds = async (kind: "pretty" | "minified" | "yaml" | "toon") => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;
    const ids = getTokenIdsFor(kind);
    if (!ids.length) return;

    try {
      await navigator.clipboard.writeText(JSON.stringify(ids));
    } catch {
      // ignore clipboard errors
    }
  };

  const getOutputFor = (kind: "pretty" | "minified" | "yaml" | "toon"): string => {
    switch (kind) {
      case "pretty":
        return prettyJson;
      case "minified":
        return minifiedJson;
      case "yaml":
        return yaml;
      case "toon":
        return toon;
      default:
        return "";
    }
  };

  const handleCopyOutput = async (kind: "pretty" | "minified" | "yaml" | "toon") => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;

    const output = getOutputFor(kind);
    if (!output) return;

    try {
      await navigator.clipboard.writeText(output);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-10 md:px-8 lg:py-16">
        <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">No auth</Badge>
              <span className="text-xs text-muted-foreground">JSON → YAML → Toon</span>
            </div>
            <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              TokenTools
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Paste JSON once and view it as pretty JSON, minified JSON, YAML, and a token-aware toon encoding.
            </p>
          </div>
        </header>

        <section className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card className="flex flex-col border-border/60">
            <CardHeader>
              <CardTitle>Input JSON</CardTitle>
              <CardDescription>Paste or type any valid JSON payload.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              <div className="space-y-2">
                <Label htmlFor="json-input">JSON</Label>
                <Textarea
                  id="json-input"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  spellCheck={false}
                  className="min-h-[220px] font-mono text-xs md:text-sm"
                  placeholder='e.g. {"user":"alice","roles":["admin","editor"]}'
                />
              </div>
              {error && (
                <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  Parse error: {error}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="h-fit border-border/60">
            <CardHeader>
              <CardTitle>Encoding options</CardTitle>
              <CardDescription>
                Configure toon encoding and optional character / byte statistics.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="encoding-format">Encoding format</Label>
                <Select
                  value={encodingFormat}
                  onValueChange={(value) => setEncodingFormat(value as EncodingFormat)}
                >
                  <SelectTrigger id="encoding-format">
                    <SelectValue placeholder="Select encoding format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="base64">Base64 (compact, default)</SelectItem>
                    <SelectItem value="hex">Hex</SelectItem>
                    <SelectItem value="url-safe">URL-safe</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  A toon is derived from the minified JSON using the selected encoding.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="toon-delimiter">TOON delimiter</Label>
                <Select value={toonDelimiter} onValueChange={(v) => setToonDelimiter(v as any)}>
                  <SelectTrigger id="toon-delimiter">
                    <SelectValue placeholder="TOON delimiter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="," defaultChecked>Comma (default)</SelectItem>
                    <SelectItem value="\t">Tab</SelectItem>
                    <SelectItem value="|">Pipe</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Label htmlFor="toon-keyfold">Key folding</Label>
                  <Select value={toonKeyFolding} onValueChange={(v) => setToonKeyFolding(v as any)}>
                    <SelectTrigger id="toon-keyfold">
                      <SelectValue placeholder="Key folding" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="off">off</SelectItem>
                      <SelectItem value="safe">safe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">TOON (Token-Oriented Object Notation) is a compact format designed for LLM inputs. See the spec for details.</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="encoding-strength">Encoding strength</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {encodingStrength}
                  </span>
                </div>
                <Slider
                  id="encoding-strength"
                  min={1}
                  max={5}
                  step={1}
                  value={[encodingStrength]}
                  onValueChange={(value) => setEncodingStrength(value[0] ?? 2)}
                />
                <p className="text-xs text-muted-foreground">
                  Higher values group encoded bytes into longer token-like chunks.
                </p>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-md border border-border/60 bg-muted/40 px-3 py-3">
                <div className="space-y-0.5">
                  <Label htmlFor="show-counts">Show character &amp; byte count</Label>
                  <p className="text-xs text-muted-foreground">
                    Counts are computed per output using UTF-8 bytes.
                  </p>
                </div>
                <Switch
                  id="show-counts"
                  checked={showCounts}
                  onCheckedChange={setShowCounts}
                />
              </div>

              <div className="flex items-center justify-between gap-4 rounded-md border border-border/60 bg-muted/40 px-3 py-3">
                <div className="space-y-0.5">
                  <Label htmlFor="show-tokens">Show tokens</Label>
                  <p className="text-xs text-muted-foreground">Enable token highlighting & token IDs</p>
                </div>
                <div className="flex items-center gap-3">
                  <Select value={tokenizationModel} onValueChange={(v) => setTokenizationModel(v)}>
                    <SelectTrigger id="tokenization-model">
                      <SelectValue placeholder="Select tokenizer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cl100k_base">cl100k_base</SelectItem>
                      <SelectItem value="gpt2">gpt2</SelectItem>
                    </SelectContent>
                  </Select>

                  <Switch id="show-tokens" checked={showTokens} onCheckedChange={setShowTokens} />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle>Outputs</CardTitle>
              <CardDescription>
                View your data across the four formats. All outputs are derived live from the input JSON.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-1">
              <Tabs defaultValue="pretty" className="space-y-4">
                <TabsList className="w-full justify-start overflow-x-auto">
                  <TabsTrigger value="pretty">Original JSON</TabsTrigger>
                  <TabsTrigger value="minified">Minified JSON</TabsTrigger>
                  <TabsTrigger value="yaml">YAML</TabsTrigger>
                  <TabsTrigger value="toon">Toon</TabsTrigger>
                </TabsList>

                <TabsContent value="pretty" className="space-y-2">
                  {showCounts && (
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="rounded-md border border-border/60 bg-muted p-2 text-xs text-muted-foreground">
                        <div className="font-medium">Tokens</div>
                        <div className="tabular-nums">{prettyTokenCounts.tokens}</div>
                      </div>

                      <div className="rounded-md border border-border/60 bg-muted p-2 text-xs text-muted-foreground">
                        <div className="font-medium">Characters</div>
                        <div className="tabular-nums">{prettyTokenCounts.chars}</div>
                      </div>

                      <div className="rounded-md border border-border/60 bg-muted p-2 text-xs text-muted-foreground">
                        <div className="font-medium">Bytes</div>
                        <div className="tabular-nums">{prettyTokenCounts.bytes}</div>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyOutput("pretty")}
                      disabled={!getOutputFor("pretty")}
                    >
                      Copy output
                    </Button>
                  {showTokens && (
                    <div className="flex items-center gap-3">
                      <ButtonGroup>
                        <Button
                          variant={tokenViewPerTab.pretty === "text" ? "default" : "outline"}
                          onClick={() => setTokenViewPerTab({ ...tokenViewPerTab, pretty: "text" })}
                        >
                          Text
                        </Button>
                        <Button
                          variant={tokenViewPerTab.pretty === "ids" ? "default" : "outline"}
                          onClick={() => setTokenViewPerTab({ ...tokenViewPerTab, pretty: "ids" })}
                        >
                          Token IDs
                        </Button>
                      </ButtonGroup>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyTokenIds("pretty")}
                        disabled={getTokenIdsFor("pretty").length === 0}
                      >
                        Copy token IDs
                      </Button>
                    </div>
                  )}
                  </div>
                  <pre className="max-h-[360px] overflow-auto rounded-md bg-muted px-3 py-2 text-xs leading-relaxed md:text-sm">
                    <code>
                      {showTokens && tokenViewPerTab.pretty === "text" && prettyTokens ? (
                        <RenderHighlighted tokens={prettyTokens as any} />
                      ) : showTokens && tokenViewPerTab.pretty === "ids" && prettyTokens ? (
                        JSON.stringify((prettyTokens as any[]).map((t) => t.id).filter(Boolean))
                      ) : (
                        prettyJson || "Pretty-printed JSON will appear here."
                      )}
                    </code>
                  </pre>
                </TabsContent>

                <TabsContent value="minified" className="space-y-2">
                  {showCounts && (
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="rounded-md border border-border/60 bg-muted p-2 text-xs text-muted-foreground">
                        <div className="font-medium">Tokens</div>
                        <div className="tabular-nums">{minifiedTokenCounts.tokens}</div>
                      </div>

                      <div className="rounded-md border border-border/60 bg-muted p-2 text-xs text-muted-foreground">
                        <div className="font-medium">Characters</div>
                        <div className="tabular-nums">{minifiedTokenCounts.chars}</div>
                      </div>

                      <div className="rounded-md border border-border/60 bg-muted p-2 text-xs text-muted-foreground">
                        <div className="font-medium">Bytes</div>
                        <div className="tabular-nums">{minifiedTokenCounts.bytes}</div>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyOutput("minified")}
                      disabled={!getOutputFor("minified")}
                    >
                      Copy output
                    </Button>
                  {showTokens && (
                    <div className="flex items-center gap-3">
                      <ButtonGroup>
                        <Button
                          variant={tokenViewPerTab.minified === "text" ? "default" : "outline"}
                          onClick={() => setTokenViewPerTab({ ...tokenViewPerTab, minified: "text" })}
                        >
                          Text
                        </Button>
                        <Button
                          variant={tokenViewPerTab.minified === "ids" ? "default" : "outline"}
                          onClick={() => setTokenViewPerTab({ ...tokenViewPerTab, minified: "ids" })}
                        >
                          Token IDs
                        </Button>
                      </ButtonGroup>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyTokenIds("minified")}
                        disabled={getTokenIdsFor("minified").length === 0}
                      >
                        Copy token IDs
                      </Button>
                    </div>
                  )}
                  </div>
                  <pre className="max-h-[360px] overflow-auto rounded-md bg-muted px-3 py-2 text-xs leading-relaxed md:text-sm">
                    <code>
                      {showTokens && tokenViewPerTab.minified === "text" && minifiedTokens ? (
                        <RenderHighlighted tokens={minifiedTokens as any} />
                      ) : showTokens && tokenViewPerTab.minified === "ids" && minifiedTokens ? (
                        JSON.stringify((minifiedTokens as any[]).map((t) => t.id).filter(Boolean))
                      ) : (
                        minifiedJson || "Minified JSON will appear here."
                      )}
                    </code>
                  </pre>
                </TabsContent>

                <TabsContent value="yaml" className="space-y-2">
                  {showCounts && (
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="rounded-md border border-border/60 bg-muted p-2 text-xs text-muted-foreground">
                        <div className="font-medium">Tokens</div>
                        <div className="tabular-nums">{yamlTokenCounts.tokens}</div>
                      </div>

                      <div className="rounded-md border border-border/60 bg-muted p-2 text-xs text-muted-foreground">
                        <div className="font-medium">Characters</div>
                        <div className="tabular-nums">{yamlTokenCounts.chars}</div>
                      </div>

                      <div className="rounded-md border border-border/60 bg-muted p-2 text-xs text-muted-foreground">
                        <div className="font-medium">Bytes</div>
                        <div className="tabular-nums">{yamlTokenCounts.bytes}</div>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyOutput("yaml")}
                      disabled={!getOutputFor("yaml")}
                    >
                      Copy output
                    </Button>
                  {showTokens && (
                      <div className="flex items-center gap-3">
                        <ButtonGroup>
                          <Button
                            variant={tokenViewPerTab.yaml === "text" ? "default" : "outline"}
                            onClick={() => setTokenViewPerTab({ ...tokenViewPerTab, yaml: "text" })}
                          >
                            Text
                          </Button>
                          <Button
                            variant={tokenViewPerTab.yaml === "ids" ? "default" : "outline"}
                            onClick={() => setTokenViewPerTab({ ...tokenViewPerTab, yaml: "ids" })}
                          >
                            Token IDs
                          </Button>
                        </ButtonGroup>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyTokenIds("yaml")}
                          disabled={getTokenIdsFor("yaml").length === 0}
                        >
                          Copy token IDs
                        </Button>
                      </div>
                  )}
                  </div>
                  <pre className="max-h-[360px] overflow-auto rounded-md bg-muted px-3 py-2 text-xs leading-relaxed md:text-sm">
                    <code>
                      {showTokens && tokenViewPerTab.yaml === "text" && yamlTokens ? (
                        <RenderHighlighted tokens={yamlTokens as any} />
                      ) : showTokens && tokenViewPerTab.yaml === "ids" && yamlTokens ? (
                        JSON.stringify((yamlTokens as any[]).map((t) => t.id).filter(Boolean))
                      ) : (
                        yaml || "YAML conversion will appear here."
                      )}
                    </code>
                  </pre>
                </TabsContent>

                <TabsContent value="toon" className="space-y-2">
                  {showCounts && (
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="rounded-md border border-border/60 bg-muted p-2 text-xs text-muted-foreground">
                        <div className="font-medium">Tokens</div>
                        <div className="tabular-nums">{toonTokenCounts.tokens}</div>
                      </div>

                      <div className="rounded-md border border-border/60 bg-muted p-2 text-xs text-muted-foreground">
                        <div className="font-medium">Characters</div>
                        <div className="tabular-nums">{toonTokenCounts.chars}</div>
                      </div>

                      <div className="rounded-md border border-border/60 bg-muted p-2 text-xs text-muted-foreground">
                        <div className="font-medium">Bytes</div>
                        <div className="tabular-nums">{toonTokenCounts.bytes}</div>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyOutput("toon")}
                      disabled={!getOutputFor("toon")}
                    >
                      Copy output
                    </Button>
                  {showTokens && (
                      <div className="flex items-center gap-3">
                        <ButtonGroup>
                          <Button
                            variant={tokenViewPerTab.toon === "text" ? "default" : "outline"}
                            onClick={() => setTokenViewPerTab({ ...tokenViewPerTab, toon: "text" })}
                          >
                            Text
                          </Button>
                          <Button
                            variant={tokenViewPerTab.toon === "ids" ? "default" : "outline"}
                            onClick={() => setTokenViewPerTab({ ...tokenViewPerTab, toon: "ids" })}
                          >
                            Token IDs
                          </Button>
                        </ButtonGroup>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyTokenIds("toon")}
                          disabled={getTokenIdsFor("toon").length === 0}
                        >
                          Copy token IDs
                        </Button>
                      </div>
                  )}
                  </div>
                  <pre className="max-h-[360px] overflow-auto rounded-md bg-muted px-3 py-2 text-xs leading-relaxed md:text-sm">
                    <code>
                      {showTokens && tokenViewPerTab.toon === "text" && toonTokens ? (
                        <RenderHighlighted tokens={(toonTokens as any[]).map((t) => ({ id: t.id, text: t.text }))} />
                      ) : showTokens && tokenViewPerTab.toon === "ids" && toonTokens ? (
                        JSON.stringify((toonTokens as any[]).map((t) => t.id))
                      ) : (
                        toon || "Toon-encoded output will appear here."
                      )}
                    </code>
                  </pre>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
