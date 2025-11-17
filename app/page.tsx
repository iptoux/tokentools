'use client';

import { useEffect, useMemo, useState, useRef } from "react";
import { Copy, Code } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

function jsonToYamlLite(value: unknown, indent = 0, tokenAware = false): string {
  const space = "  ".repeat(indent);

  if (value === null || typeof value !== "object") {
    if (typeof value === "string") {
      // Token-aware formatting: omit quotes for simple, safe strings
      if (tokenAware && /^[a-zA-Z0-9_-]+$/.test(value) && !isReservedYamlWord(value)) {
        return value;
      }
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
        const nested = jsonToYamlLite(item, indent + 1, tokenAware);
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
      const nested = jsonToYamlLite(val, indent + 1, tokenAware);
      if (val !== null && typeof val === "object") {
        return `${space}${key}:\n${"  ".repeat(indent + 1)}${nested.replace(/\n/g, `\n${"  ".repeat(indent + 1)}`)}`;
      }

      return `${space}${key}: ${nested}`;
    })
    .join("\n");
}

function isReservedYamlWord(word: string): boolean {
  const reserved = ['true', 'false', 'null', 'yes', 'no', 'on', 'off', 'true', '~'];
  return reserved.includes(word.toLowerCase());
}

function jsonStringify(value: unknown, tokenAware = false, indent?: number | string): string {
  if (!tokenAware) {
    return JSON.stringify(value, null, indent);
  }

  return JSON.stringify(value, (key, val) => {
    // For strings, omit quotes if safe and token-aware is enabled
    if (typeof val === "string" && /^[a-zA-Z0-9_-]+$/.test(val) && !isReservedYamlWord(val)) {
      // Return a special marker that we'll handle in postprocessing
      return `__UNQUOTED__${val}__`;
    }
    return val;
  }, indent)
    .replace(/\"__UNQUOTED__(.+?)__\"/g, '$1'); // Remove quotes from marked strings
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState<string>('{"hello": "world"}');
  const [encodingFormat, setEncodingFormat] = useState<EncodingFormat>("base64");
  const [encodingStrength, setEncodingStrength] = useState<number>(2);
  const [showCounts, setShowCounts] = useState<boolean>(true);
  const [showCopyReady, setShowCopyReady] = useState<boolean>(false);
  const [toonDelimiter, setToonDelimiter] = useState<"," | "\t" | "|">(",");
  const [toonKeyFolding, setToonKeyFolding] = useState<'off' | 'safe'>('off');
  const [showTokens, setShowTokens] = useState<boolean>(false);
  const [showTokenAware, setShowTokenAware] = useState<boolean>(false);
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

  const handleFileLoad = (file: File) => {
    if (file && file.type === "application/json") {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setInput(event.target.result as string);
        }
      };
      reader.readAsText(file);
    }
  };

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
      const pretty = jsonStringify(parsed, showTokenAware, 2);
      const minified = jsonStringify(parsed, showTokenAware);
      const yamlText = jsonToYamlLite(parsed, 0, showTokenAware);

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
  }, [input, encodingFormat, encodingStrength, showTokenAware]);

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
              <Badge variant="outline">• TOKEN STUDIO</Badge>
            </div>
            <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              JSON to YAML to TOON
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Paste JSON, explore alternate formats, and see how token counts change for different encodings.
            </p>
          </div>
        </header>

        <section className="grid flex-1 gap-6 lg:grid-cols-2">
          {/* LEFT: Input JSON */}
          <Card className="flex flex-col border-border/60">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Input JSON</CardTitle>
                  <CardDescription>Bring your payload; we handle format and token math.</CardDescription>
                </div>
                <Badge variant="outline" className="whitespace-nowrap">
                  <span className="mr-1 inline-block h-2 w-2 rounded-full bg-green-500"></span>
                  Live validated
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              <div className="space-y-2">
                <Label htmlFor="json-input">Payload</Label>
                <Textarea
                  id="json-input"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  spellCheck={false}
                  className="min-h-[220px] font-mono text-xs md:text-sm"
                  placeholder='Paste JSON or type { "users": [...] }'
                />
              </div>
              {error && (
                <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  Parse error: {error}
                </p>
              )}
              <div className="mt-auto">
                <Button variant="outline" size="sm" className="w-full">
                  <span className="mr-2">📋</span>
                  Load sample
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* RIGHT: Format and Comparison */}
          <Card className="flex flex-col border-border/60">
            <CardHeader>
              <CardTitle>Format and Token Comparison</CardTitle>
              <CardDescription>Compare the same payload as pretty JSON, minified JSON, YAML, and TOON.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-6">
              {/* Feature Badges */}
              <div className="flex flex-wrap gap-2">
                <Badge 
                  variant={showTokenAware ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setShowTokenAware(!showTokenAware)}
                >
                  Token aware
                </Badge>
                <Badge 
                  variant={showCopyReady ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setShowCopyReady(!showCopyReady)}
                >
                  Copy-ready payloads
                </Badge>
                <Badge 
                  variant={showCounts ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setShowCounts(!showCounts)}
                >
                  Character and byte counts
                </Badge>
                <Badge 
                  variant={showTokens ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setShowTokens(!showTokens)}
                >
                  Show tokens
                </Badge>
              </div>

              {/* Settings */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="encoding">ENCODING</Label>
                  <Select
                    value={encodingFormat}
                    onValueChange={(value) => setEncodingFormat(value as EncodingFormat)}
                  >
                    <SelectTrigger id="encoding" className="w-full">
                      <SelectValue placeholder="Select encoding" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="base64">base64</SelectItem>
                      <SelectItem value="hex">hex</SelectItem>
                      <SelectItem value="url-safe">url-safe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div 
                  className="rounded-md border-2 border-dashed border-muted-foreground/30 bg-muted/20 p-6 text-center transition-colors hover:border-muted-foreground/50 hover:bg-muted/40 cursor-pointer"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add("border-primary", "bg-primary/5");
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.classList.remove("border-primary", "bg-primary/5");
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove("border-primary", "bg-primary/5");
                    const file = e.dataTransfer.files[0];
                    if (file) {
                      handleFileLoad(file);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input 
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleFileLoad(file);
                      }
                    }}
                  />
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-2xl">↓</div>
                    <p className="text-center text-sm text-muted-foreground leading-relaxed">
                      Paste or load sample JSON on the left to see how tokens and bytes shift across formats.
                    </p>
                  </div>
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
                  <div className="flex items-center justify-end">
                    <div className="flex items-center gap-2">
                      {showTokens && (
                        <>
                          <Badge
                            variant={tokenViewPerTab.pretty === "text" ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => setTokenViewPerTab({ ...tokenViewPerTab, pretty: "text" })}
                          >
                            Text
                          </Badge>
                          <Badge
                            variant={tokenViewPerTab.pretty === "ids" ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => setTokenViewPerTab({ ...tokenViewPerTab, pretty: "ids" })}
                          >
                            Token IDs
                          </Badge>
                        </>
                      )}
                      {showCopyReady && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyOutput("pretty")}
                                disabled={!getOutputFor("pretty")}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Copy output</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {showTokens && showCopyReady && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyTokenIds("pretty")}
                                disabled={getTokenIdsFor("pretty").length === 0}
                              >
                                <Code className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Copy token IDs</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
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
                  <div className="flex items-center justify-end">
                    <div className="flex items-center gap-2">
                      {showTokens && (
                        <>
                          <Badge
                            variant={tokenViewPerTab.minified === "text" ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => setTokenViewPerTab({ ...tokenViewPerTab, minified: "text" })}
                          >
                            Text
                          </Badge>
                          <Badge
                            variant={tokenViewPerTab.minified === "ids" ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => setTokenViewPerTab({ ...tokenViewPerTab, minified: "ids" })}
                          >
                            Token IDs
                          </Badge>
                        </>
                      )}
                      {showCopyReady && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyOutput("minified")}
                                disabled={!getOutputFor("minified")}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Copy output</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {showTokens && showCopyReady && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyTokenIds("minified")}
                                disabled={getTokenIdsFor("minified").length === 0}
                              >
                                <Code className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Copy token IDs</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
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
                  <div className="flex items-center justify-end">
                    <div className="flex items-center gap-2">
                      {showTokens && (
                        <>
                          <Badge
                            variant={tokenViewPerTab.yaml === "text" ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => setTokenViewPerTab({ ...tokenViewPerTab, yaml: "text" })}
                          >
                            Text
                          </Badge>
                          <Badge
                            variant={tokenViewPerTab.yaml === "ids" ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => setTokenViewPerTab({ ...tokenViewPerTab, yaml: "ids" })}
                          >
                            Token IDs
                          </Badge>
                        </>
                      )}
                      {showCopyReady && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyOutput("yaml")}
                                disabled={!getOutputFor("yaml")}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Copy output</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {showTokens && showCopyReady && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyTokenIds("yaml")}
                                disabled={getTokenIdsFor("yaml").length === 0}
                              >
                                <Code className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Copy token IDs</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
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
                  <div className="flex items-center justify-end">
                    <div className="flex items-center gap-2">
                      {showTokens && (
                        <>
                          <Badge
                            variant={tokenViewPerTab.toon === "text" ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => setTokenViewPerTab({ ...tokenViewPerTab, toon: "text" })}
                          >
                            Text
                          </Badge>
                          <Badge
                            variant={tokenViewPerTab.toon === "ids" ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => setTokenViewPerTab({ ...tokenViewPerTab, toon: "ids" })}
                          >
                            Token IDs
                          </Badge>
                        </>
                      )}
                      {showCopyReady && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyOutput("toon")}
                                disabled={!getOutputFor("toon")}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Copy output</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {showTokens && showCopyReady && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyTokenIds("toon")}
                                disabled={getTokenIdsFor("toon").length === 0}
                              >
                                <Code className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Copy token IDs</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
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
