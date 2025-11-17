import { useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

type InputCardProps = {
  input: string;
  onInputChange: (value: string) => void;
  error: string;
  onFileLoad: (file: File) => void;
};

const SAMPLE_JSON = {
  user: {
    id: "usr_12345",
    name: "John Doe",
    email: "john.doe@example.com",
    created_at: "2024-01-15T10:30:00Z",
    profile: {
      avatar_url: "https://example.com/avatars/john.jpg",
      bio: "Software engineer and open source enthusiast",
      location: "San Francisco, CA",
      social_links: {
        github: "https://github.com/johndoe",
        twitter: "https://twitter.com/johndoe"
      }
    },
    preferences: {
      theme: "dark",
      notifications_enabled: true,
      language: "en"
    }
  },
  tokens: [
    { id: "tok_001", value: 1000, expires_at: "2025-12-31" },
    { id: "tok_002", value: 5000, expires_at: "2026-06-30" }
  ],
  metadata: {
    version: "1.0.0",
    processed_at: "2024-11-18T14:22:15Z"
  }
};

export function InputCard({ input, onInputChange, error, onFileLoad }: InputCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLoadSample = () => {
    onInputChange(JSON.stringify(SAMPLE_JSON, null, 2));
  };

  const handleFileSelect = (file: File | null) => {
    if (file && file.type === "application/json") {
      onFileLoad(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result && typeof event.target.result === "string") {
          onInputChange(event.target.result);
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <Card className="flex flex-col border-border/60 h-fit">
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
          <ScrollArea className="h-[400px] rounded-md border">
            <Textarea
              id="json-input"
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              spellCheck={false}
              className="min-h-full border-0 font-mono text-xs md:text-sm resize-none"
              placeholder='{"hello": "world"}'
            />
          </ScrollArea>
        </div>
        {error && (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            Parse error: {error}
          </p>
        )}
        <div className="mt-auto">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={handleLoadSample}
          >
            <span className="mr-2">📋</span>
            Load sample
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleFileSelect(file);
            }
          }}
        />
      </CardContent>
    </Card>
  );
}

