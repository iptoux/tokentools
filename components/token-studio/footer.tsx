'use client';

import Link from "next/link";

export function Footer() {
  return (
    <footer className="">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8">
        <div className="flex items-center justify-center">
          <div className="text-center text-sm text-muted-foreground">
            Made with <span className="text-destructive">❤️</span> using{' '}
            <Link
              href="https://nextjs.org"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground hover:underline"
            >
              Next.js
            </Link>
            {' '}and{' '}
            <Link
              href="https://react.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground hover:underline"
            >
              React
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

