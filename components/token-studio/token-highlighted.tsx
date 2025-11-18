import type { TokenForDisplay } from "@/lib/utils/tokenization";
import { colorForTokenId } from "@/lib/utils/tokenization";

type TokenHighlightedProps = {
  tokens: TokenForDisplay[];
};

export function TokenHighlighted({ tokens }: TokenHighlightedProps) {
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
          <span
            key={i}
            style={{ backgroundColor: "rgba(128, 128, 128, 0.1)", borderRadius: 4 }}
            className="px-[2px] py-[1px]"
          >
            {t.text}
          </span>
        )
      )}
    </>
  );
}

