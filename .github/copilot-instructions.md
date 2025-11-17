# TokenTools - AI Coding Agent Instructions

**TokenTools** is a Next.js 16 application for tokenizing text using the OpenAI GPT tokenizer (cl100k_base). It provides both a web UI and an API endpoint for encoding/decoding text into tokens.

## Architecture

### Project Structure
- **`app/page.tsx`**: Main client component (1000+ lines) - handles UI state, tokenization logic, and output formatting
- **`app/api/tokenize/route.ts`**: Server-side API endpoint using `@dqbd/tiktoken` for accurate token encoding
- **`components/ui/`**: Radix UI + Tailwind CSS component library (50+ pre-built components)
- **`lib/utils.ts`**: Utility function `cn()` for merging Tailwind classes with `clsx` and `twMerge`

### Data Flow
1. **Client**: User enters text → approximate token count (heuristic: bytes/4)
2. **Server API** (`POST /api/tokenize`): Sends `{ model, texts }` → receives `{ model, tokens }`
3. **Output Formats**: JSON, YAML, or TOON encoding with optional token-aware formatting

## Key Patterns & Conventions

### UI Component Library (Radix UI + CVA)
- All components use **class-variance-authority (CVA)** for variant management (see `components/ui/button.tsx`)
- Styling combines: `cn()` utility (wraps `twMerge` + `clsx`), Tailwind, and inline styles
- Theme support via `next-themes` with dark/light mode in `app/layout.tsx`
- Common patterns:
  ```tsx
  const buttonVariants = cva("base styles", {
    variants: { variant: {...}, size: {...} },
    defaultVariants: {...}
  });
  // Usage: <Button variant="destructive" size="sm" />
  ```

### Client-Side State Management (page.tsx)
- Uses React hooks only (`useState`, `useRef`, `useEffect`, `useMemo`)
- Heavy use of utility functions for encoding/formatting:
  - `approximateTokensFromText()`: Simple heuristic (bytes/4)
  - `encodeWithFormat()`: Supports base64, hex, url-safe
  - `jsonToYamlLite()`: Custom YAML formatter with token-aware quotes
  - `simpleTokenize()`: Fallback tokenizer for UI visualization
- Token highlighting: Color by token ID using HSL hash: `hue = (id * 47) % 360`

### API Endpoint Pattern (route.ts)
- Validates request: `{ model: string, texts: Record<string, string> }`
- Currently only supports `"cl100k_base"` model (OpenAI GPT-3.5/4)
- Returns token list per text key: `Record<string, Token[]>` where `Token = { id, text }`
- **Important**: Call `encoding.free()` after use (resource cleanup)
- **Extending models**: To add support for other models (e.g., `"o200k_base"`):
  ```typescript
  // In route.ts, replace the single model check:
  const supportedModels = ["cl100k_base", "o200k_base", "p50k_base"];
  if (!supportedModels.includes(model)) {
    return NextResponse.json({ error: `Unsupported model: ${model}` }, { status: 400 });
  }
  const encoding = get_encoding(model); // Use dynamic model selection
  ```

### TOON Format Integration
- **TOON** is a compact text-based format (alternative to JSON/YAML) using configurable delimiters
- Encoding function: `toToonEncoding(parsed, delimiter, keyFolding)` where:
  - `delimiter`: `","` (default), `"\t"`, or `"|"` - field separator
  - `keyFolding`: `"off"` (default) or `"safe"` - key normalization for safety
- Library: `@toon-format/toon` - handles encoding; graceful fallback on error
- State management for TOON options in page.tsx:
  ```tsx
  const [toonDelimiter, setToonDelimiter] = useState<"," | "\t" | "|">(",");
  const [toonKeyFolding, setToonKeyFolding] = useState<'off' | 'safe'>('off');
  ```
- TOON has a fourth output tab alongside JSON (pretty/minified) and YAML
- Token counting for TOON uses `simpleTokenize()` with filtering to exclude whitespace-only tokens

### TypeScript Configuration
- Strict mode enabled
- Path aliases: `@/*` resolves to workspace root (e.g., `@/components/ui/button`)
- Target: ES2017

## Development Workflow

### Build & Run
```bash
pnpm dev          # Start Next.js dev server (localhost:3000)
pnpm build        # Production build
pnpm start        # Run production server
pnpm lint         # Run ESLint
```

### Dependencies
- **Tokenization**: `@dqbd/tiktoken` (official OpenAI tokenizer wrapper)
- **UI**: 50+ Radix UI components + `next-themes`
- **Styling**: Tailwind CSS, `class-variance-authority`, `clsx`, `tailwind-merge`
- **Forms**: `react-hook-form` + `@hookform/resolvers`
- **Icons**: `lucide-react`
- **Serialization**: `@toon-format/toon` (alternative to JSON/YAML)

## Important Implementation Notes

1. **SSR/Browser Detection**: Use `typeof window === "undefined"` for Node.js vs browser checks (text encoding differs)
2. **Token Visualization**: Tokens with `id: null` are whitespace; render without background color
3. **YAML Formatting**: Token-aware mode omits quotes for safe identifiers (avoid reserved YAML words)
4. **Encoding Models**: Route currently hardcodes `cl100k_base`; extend the model check to support others
5. **Resource Management**: Always call `encoding.free()` in API responses to prevent memory leaks
6. **Client Component**: `app/page.tsx` uses `'use client'` directive; all hooks are safe

## Performance Considerations for Large Token Lists

**Token List Rendering**: No virtual scrolling or pagination implemented; large outputs (10k+ tokens) will impact performance
- **Problem**: `RenderHighlighted` component maps over full token array; browser must render all DOM nodes
- **Mitigation options**:
  - Slice visible tokens: `tokens.slice(0, 500)` with "show more" button
  - Add virtual scrolling: use `@tanstack/react-virtual` or similar library
  - Lazy-render: only highlight tokens when "Show Tokens" tab is active (already implemented via `useEffect` guard)
- **Current optimization**: Token fetching via API only runs when `showTokens || showCounts` is true (see `useEffect` in page.tsx ~line 300)

**Memory Usage**: 
- `@dqbd/tiktoken` encoding instances are cleaned up via `encoding.free()` in the API route
- Large JSON parsing (>1MB) may cause page freeze during `JSON.parse()` and format conversions
- No lazy parsing; all formats (JSON, YAML, TOON) are computed on every input change via `useMemo` dependency array

**Network Optimization**:
- Token API only fires when needed (guarded by `showTokens && showCounts` check)
- Uses `AbortController` to cancel in-flight requests when dependencies change
- Tokenization grouped by 4 formats in a single request (pretty, minified, yaml, toon) rather than 4 separate calls

**Optimization Techniques Already in Use**:
- `useMemo` for computing all output formats to avoid recalculation on render
- `useRef` for file input to avoid unnecessary DOM queries
- Tab-based UI prevents rendering hidden content
- Token-aware mode computes unquoted strings post-render (regex substitution) to minimize JSON stringify overhead

## Testing & Validation

- No test files present; focus on manual integration testing
- API endpoint validation: incorrect `model` or missing `texts` returns 400/500 errors
- Approximate token count helps compare across encoding formats without server call

## When Modifying

- **Adding UI components**: Follow CVA pattern in existing button/card examples
- **Adding API features**: Validate inputs, update response types, ensure `encoding.free()`
- **Adding output formats**: 
  - Add state: `const [formatOption, setFormatOption] = useState(...)`
  - Add computation in `useMemo` block (returns `{ ... existing, newFormat: ... }`)
  - Add counts calculation: `const newFormatCounts = calculateCounts(newFormat)`
  - Add TabsContent in the JSX with `<RenderHighlighted tokens={...} />` or `<pre>{...}</pre>`
  - Example: TOON format added as 4th tab (see lines 1010-1050 in page.tsx)
- **Adding tokenization models**:
  1. Update route.ts: add model to supportedModels array and use dynamic `get_encoding(model)`
  2. Update page.tsx: add to Select dropdown options for `tokenizationModel` 
  3. Update type in route.ts to accept model parameter dynamically
  4. Test: ensure `encoding.free()` is called for all code paths
- **Styling**: Use `cn()` for class merging; prefer Tailwind classes over inline styles
- **Improving large list performance**:
  - Add token pagination: slice with limit `const visibleTokens = tokens.slice(0, MAX_DISPLAY)`
  - Guard expensive operations: wrap token rendering in conditional `{showTokens && <RenderHighlighted ... />}`
  - Consider virtual scrolling for outputs >5000 tokens
