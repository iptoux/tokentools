'use client';

import { useMemo, useState } from "react";
import { InputCard } from "@/components/token-studio/input-card";
import { FormatSettingsCard } from "@/components/token-studio/format-settings-card";
import { OutputTabs } from "@/components/token-studio/output-tabs";
import { useTokenization } from "@/hooks/use-tokenization";
import { calculateCounts, approximateTokensFromText, simpleTokenize, getTokenIds } from "@/lib/utils/tokenization";
import { jsonStringify } from "@/lib/utils/json";
import { jsonToYamlLite } from "@/lib/utils/json";
import { toToonEncoding } from "@/lib/utils/toon";
import { jsonToToml } from "@/lib/utils/toml";
import type { 
  EncodingFormat, 
  OutputFormat, 
  TokenCounts, 
  TokenViewMode, 
  TokenViewPerTab, 
  ToonDelimiter, 
  ToonKeyFolding,
  TokenizationModel,
} from "@/lib/types";
import type { TokenForDisplay} from "@/lib/utils/tokenization";

export default function Home() {
  const [input, setInput] = useState<string>('');
  const [encodingFormat, setEncodingFormat] = useState<EncodingFormat>("base64");
  const [showCounts, setShowCounts] = useState<boolean>(true);
  const [showCopyReady, setShowCopyReady] = useState<boolean>(false);
  const [toonDelimiter] = useState<ToonDelimiter>(",");
  const [toonKeyFolding] = useState<ToonKeyFolding>('off');
  const [showTokens, setShowTokens] = useState<boolean>(false);
  const [showTokenAware, setShowTokenAware] = useState<boolean>(false);
  const [tokenizationModel] = useState<TokenizationModel>("cl100k_base");
  const [tokenViewPerTab, setTokenViewPerTab] = useState<TokenViewPerTab>({
    pretty: "text",
    minified: "text",
    yaml: "text",
    toon: "text",
    toml: "text",
  });

  const handleFileLoad = (file: File) => {
    if (file && file.type === "application/json") {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result && typeof event.target.result === "string") {
          setInput(event.target.result);
        }
      };
      reader.readAsText(file);
    }
  };

  const { error, prettyJson, minifiedJson, yaml, toon, toml } = useMemo(() => {
    if (!input.trim()) {
      return {
        error: "",
        prettyJson: "",
        minifiedJson: "",
        yaml: "",
        toon: "",
        toml: "",
      };
    }

    try {
      const parsed = JSON.parse(input);
      const pretty = jsonStringify(parsed, showTokenAware, 2);
      const minified = jsonStringify(parsed, showTokenAware);
      const yamlText = jsonToYamlLite(parsed, 0, showTokenAware);
      const toonText = toToonEncoding(parsed, toonDelimiter, toonKeyFolding);
      const tomlText = jsonToToml(parsed, showTokenAware);

      return {
        error: "",
        prettyJson: pretty,
        minifiedJson: minified,
        yaml: yamlText,
        toon: toonText,
        toml: tomlText,
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Invalid JSON",
        prettyJson: "",
        minifiedJson: "",
        yaml: "",
        toon: "",
        toml: "",
      };
    }
  }, [input, showTokenAware, toonDelimiter, toonKeyFolding]);

  const texts = useMemo(() => ({
    pretty: prettyJson,
    minified: minifiedJson,
    yaml,
    toon,
    toml,
  }), [prettyJson, minifiedJson, yaml, toon, toml]);

  const { exactTokens } = useTokenization({
    texts,
    tokenizationModel,
    showTokens,
    showCounts,
  });

  const prettyCounts = calculateCounts(prettyJson);
  const minifiedCounts = calculateCounts(minifiedJson);
  const yamlCounts = calculateCounts(yaml);
  const toonCounts = calculateCounts(toon);
  const tomlCounts = calculateCounts(toml);

  const prettyTokenCount = approximateTokensFromText(prettyJson);
  const minifiedTokenCount = approximateTokensFromText(minifiedJson);
  const yamlTokenCount = approximateTokensFromText(yaml);
  const toonTokenCount = toon ? simpleTokenize(toon).filter((t) => t.id || t.text.trim()).length : 0;
  const tomlTokenCount = approximateTokensFromText(toml);

  const prettyTokenCounts: TokenCounts = { ...prettyCounts, tokens: prettyTokenCount };
  const minifiedTokenCounts: TokenCounts = { ...minifiedCounts, tokens: minifiedTokenCount };
  const yamlTokenCounts: TokenCounts = { ...yamlCounts, tokens: yamlTokenCount };
  const toonTokenCounts: TokenCounts = { ...toonCounts, tokens: toonTokenCount };
  const tomlTokenCounts: TokenCounts = { ...tomlCounts, tokens: tomlTokenCount };

  // Update token counts with exact tokens if available
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
    if (exactTokens.toml && exactTokens.toml.length > 0) {
      tomlTokenCounts.tokens = exactTokens.toml.length;
    }
  }

  // Compute tokens for display
  const getTokensForFormat = (format: OutputFormat): TokenForDisplay[] | undefined => {
    if (!showTokens) return undefined;

    if (tokenizationModel === "cl100k_base" && exactTokens[format] && exactTokens[format].length > 0) {
      return exactTokens[format];
    }

    const text = texts[format];
    if (!text) return undefined;

    const simpleTokens = simpleTokenize(text);
    
    if (format === "toon") {
      return simpleTokens.map((t) => ({ id: t.id ?? undefined, text: t.text }));
    }

    return simpleTokens.map((t) => ({ id: t.id, text: t.text }));
  };

  const prettyTokens = getTokensForFormat("pretty");
  const minifiedTokens = getTokensForFormat("minified");
  const yamlTokens = getTokensForFormat("yaml");
  const toonTokens = getTokensForFormat("toon");
  const tomlTokens = getTokensForFormat("toml");

  // Update token counts from displayed tokens if available
  if (showTokens) {
    if (prettyTokens) {
      const tokenIds = getTokenIds(prettyTokens);
      prettyTokenCounts.tokens = tokenIds.length;
    }
    if (minifiedTokens) {
      const tokenIds = getTokenIds(minifiedTokens);
      minifiedTokenCounts.tokens = tokenIds.length;
    }
    if (yamlTokens) {
      const tokenIds = getTokenIds(yamlTokens);
      yamlTokenCounts.tokens = tokenIds.length;
    }
    if (toonTokens) {
      toonTokenCounts.tokens = toonTokens.length;
    }
    if (tomlTokens) {
      const tokenIds = getTokenIds(tomlTokens);
      tomlTokenCounts.tokens = tokenIds.length;
    }
  }

  const getTokenIdsFor = (format: OutputFormat): number[] => {
    if (tokenizationModel === "cl100k_base" && exactTokens[format]) {
      return getTokenIds(exactTokens[format]);
    }

    const tokens = format === "pretty" ? prettyTokens 
      : format === "minified" ? minifiedTokens
      : format === "yaml" ? yamlTokens
      : format === "toon" ? toonTokens
      : tomlTokens;

    if (!tokens) return [];
    return getTokenIds(tokens);
  };

  const handleCopyTokenIds = async (format: OutputFormat) => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;
    const ids = getTokenIdsFor(format);
    if (!ids.length) return;

    try {
      await navigator.clipboard.writeText(JSON.stringify(ids));
    } catch {
      // ignore clipboard errors
    }
  };

  const getOutputFor = (format: OutputFormat): string => {
    return texts[format] || "";
  };

  const handleCopyOutput = async (format: OutputFormat) => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;

    const output = getOutputFor(format);
    if (!output) return;

    try {
      await navigator.clipboard.writeText(output);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleTokenViewPerTabChange = (format: OutputFormat, mode: TokenViewMode) => {
    setTokenViewPerTab({ ...tokenViewPerTab, [format]: mode });
  };

  return (
      <main className="mx-auto flex h-full w-full max-w-6xl flex-col gap-8 px-4 py-10 md:px-8 lg:py-16">

        <section className="grid flex-1 gap-6 lg:grid-cols-2">
          <InputCard
            input={input}
            onInputChange={setInput}
            error={error}
            onFileLoad={handleFileLoad}
          />

          <FormatSettingsCard
            encodingFormat={encodingFormat}
            onEncodingFormatChange={setEncodingFormat}
            showTokenAware={showTokenAware}
            onShowTokenAwareChange={setShowTokenAware}
            showCopyReady={showCopyReady}
            onShowCopyReadyChange={setShowCopyReady}
            showCounts={showCounts}
            onShowCountsChange={setShowCounts}
            showTokens={showTokens}
            onShowTokensChange={setShowTokens}
            onFileLoad={handleFileLoad}
          />
        </section>

        {input.trim() && (
          <section>
            <OutputTabs
              outputs={{
                pretty: prettyJson,
                minified: minifiedJson,
                yaml,
                toon,
                toml,
              }}
              counts={{
                pretty: prettyTokenCounts,
                minified: minifiedTokenCounts,
                yaml: yamlTokenCounts,
                toon: toonTokenCounts,
                toml: tomlTokenCounts,
              }}
              showCounts={showCounts}
              showTokens={showTokens}
              showCopyReady={showCopyReady}
              tokenViewPerTab={tokenViewPerTab}
              onTokenViewPerTabChange={handleTokenViewPerTabChange}
              tokens={{
                pretty: prettyTokens,
                minified: minifiedTokens,
                yaml: yamlTokens,
                toon: toonTokens,
                toml: tomlTokens,
              }}
              onCopyOutput={handleCopyOutput}
              onCopyTokenIds={handleCopyTokenIds}
            />
          </section>
        )}
      </main>
  );
}
