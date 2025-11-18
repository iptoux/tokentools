import { Info } from "lucide-react";
import type { TokenCounts } from "@/lib/types";
import type { TokenForDisplay } from "@/lib/utils/tokenization";
import { getTokenIds } from "@/lib/utils/tokenization";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type CountsDisplayProps = {
  counts: TokenCounts;
  tokens?: TokenForDisplay[];
};

export function CountsDisplay({ counts, tokens }: CountsDisplayProps) {
  // Calculate non-whitespace token count
  const nonWhitespaceTokenCount = tokens ? getTokenIds(tokens).length : undefined;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="rounded-md border border-border/60 bg-muted p-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <span className="font-medium">Tokens</span>
          {nonWhitespaceTokenCount !== undefined && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground/60" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p>Total token count includes whitespace tokens.</p>
                  <p>Non-whitespace tokens: <span className="font-semibold">{nonWhitespaceTokenCount}</span></p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="tabular-nums">
          {counts.tokens}
          {nonWhitespaceTokenCount !== undefined && (
            <span className="text-xs text-muted-foreground/70 ml-1">({nonWhitespaceTokenCount})</span>
          )}
        </div>
      </div>

      <div className="rounded-md border border-border/60 bg-muted p-2 text-xs text-muted-foreground">
        <div className="font-medium">Characters</div>
        <div className="tabular-nums">{counts.chars}</div>
      </div>

      <div className="rounded-md border border-border/60 bg-muted p-2 text-xs text-muted-foreground">
        <div className="font-medium">Bytes</div>
        <div className="tabular-nums">{counts.bytes}</div>
      </div>
    </div>
  );
}

