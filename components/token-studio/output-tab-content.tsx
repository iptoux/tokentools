import { TokenHighlighted } from "./token-highlighted";
import { CountsDisplay } from "./counts-display";
import { OutputActions } from "./output-actions";
import type { OutputFormat, TokenViewMode, TokenCounts } from "@/lib/types";
import type { TokenForDisplay } from "@/lib/utils/tokenization";
import { getTokenIds } from "@/lib/utils/tokenization";

type OutputTabContentProps = {
  format: OutputFormat;
  output: string;
  counts: TokenCounts;
  showCounts: boolean;
  showTokens: boolean;
  showCopyReady: boolean;
  tokenViewMode: TokenViewMode;
  onTokenViewModeChange: (mode: TokenViewMode) => void;
  tokens: TokenForDisplay[] | undefined;
  onCopyOutput: () => void;
  onCopyTokenIds: () => void;
  placeholder: string;
};

export function OutputTabContent({
  output,
  counts,
  showCounts,
  showTokens,
  showCopyReady,
  tokenViewMode,
  onTokenViewModeChange,
  tokens,
  onCopyOutput,
  onCopyTokenIds,
  placeholder,
}: OutputTabContentProps) {
  const renderContent = () => {
    if (showTokens && tokenViewMode === "text" && tokens) {
      return <TokenHighlighted tokens={tokens} />;
    }
    if (showTokens && tokenViewMode === "ids" && tokens) {
      const tokenIds = getTokenIds(tokens);
      return JSON.stringify(tokenIds);
    }
    return output || placeholder;
  };

  return (
    <div className="space-y-2">
      {showCounts && <CountsDisplay counts={counts} tokens={tokens} />}
      <OutputActions
        showTokens={showTokens}
        showCopyReady={showCopyReady}
        tokenViewMode={tokenViewMode}
        onTokenViewModeChange={onTokenViewModeChange}
        onCopyOutput={onCopyOutput}
        onCopyTokenIds={onCopyTokenIds}
        hasOutput={!!output}
        tokens={tokens}
      />
      <pre className="max-h-[360px] overflow-auto rounded-md bg-muted px-3 py-2 text-xs leading-relaxed md:text-sm">
        <code>{renderContent()}</code>
      </pre>
    </div>
  );
}

