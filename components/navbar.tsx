"use client";

import Link from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";
import { Moon, Sun, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export function Navbar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [starCount, setStarCount] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Fetch GitHub star count
    fetch('https://api.github.com/repos/iptoux/tokenstudio')
      .then(res => res.json())
      .then(data => {
        if (data.stargazers_count !== undefined) {
          setStarCount(data.stargazers_count);
        }
      })
      .catch(() => {
        // Silently fail if API is unavailable
      });
  }, []);

  return (
    <nav className="sticky top-0 z-50 w-full max-w-6xl mx-auto border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 rounded-b-lg">
      <div className="container flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/tokenstudio-logo.png"
            alt="Token Studio Logo"
            width={32}
            height={32}
            className="h-8 w-8"
          />
          <span className="text-lg font-semibold">Token Studio</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="https://github.com/iptoux/tokenstudio"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Github className="h-4 w-4" />
            <span>Star</span>
            {starCount !== null && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
                {starCount}
              </span>
            )}
          </Link>
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}

