import Image from "next/image";
import type { ReactNode } from "react";

import { IMAGES } from "../../constants/images";

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-surface text-ink">
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-50 -translate-y-24 rounded-xl bg-field px-4 py-3 text-sm font-bold text-brand transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 motion-reduce:transition-none"
      >
        Skip to content
      </a>

      <Image
        aria-hidden
        src={IMAGES.campusMap}
        alt=""
        fill
        priority
        sizes="100vw"
        className="pointer-events-none object-cover object-[58%_center] opacity-80"
      />
      <div aria-hidden className="absolute inset-0 bg-surface/80" />

      <header className="relative z-10 bg-brand">
        <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between gap-2 px-5 sm:h-24 sm:px-10 lg:px-16">
          <a
            href="/"
            className="flex h-7 shrink-0 items-center rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand"
            aria-label="SkateU home"
          >
            <Image
              src={IMAGES.brandLockup}
              alt=""
              className="h-6 w-[130px] object-contain object-left"
              priority
            />
          </a>
        </div>
        <div aria-hidden className="h-1 bg-accent" />
      </header>

      {children}

      <footer className="relative z-10 border-t border-white/40 bg-brand text-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-3 px-5 py-5 text-center text-[11px] font-bold uppercase tracking-[0.12em] sm:flex-row sm:justify-between sm:px-10 sm:text-left sm:tracking-[0.16em] lg:px-16">
          <span>© 2026 SkateU</span>
          <nav
            className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 normal-case tracking-normal"
            aria-label="Legal"
          >
            <a
              href="/privacy"
              className="text-white/90 underline-offset-2 transition-colors hover:text-white hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand"
            >
              Privacy Policy
            </a>
          </nav>
          <div className="flex items-center gap-2" aria-label="Follow SkateU on social media">
            <a
              href="https://www.instagram.com/skateuapp/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow SkateU on Instagram"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/40 text-white transition-colors hover:bg-white hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand motion-reduce:transition-none"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
            </a>
            <a
              href="https://www.tiktok.com/@skateuapp"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow SkateU on TikTok"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/40 text-white transition-colors hover:bg-white hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand motion-reduce:transition-none"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M12.53 0c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.98-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.9 3.14-1.42-.02-2.83-.41-4.05-1.13-2.02-1.19-3.44-3.33-3.65-5.67-.02-.5-.03-1-.01-1.5.18-1.89 1.04-3.7 2.37-5.05 1.51-1.54 3.8-2.27 5.94-1.98.02 1.48-.04 2.96-.04 4.44-.98-.32-2.11-.24-3.02.3-.66.38-1.2.98-1.53 1.65-.27.65-.28 1.37-.25 2.07.19 2.32 2.17 4.25 4.5 4.19.78-.01 1.52-.25 2.14-.67.74-.49 1.31-1.24 1.63-2.07.21-.51.3-1.07.3-1.62.01-5.24-.01-10.48.01-15.72Z" />
              </svg>
            </a>
            <a
              href="https://www.youtube.com/@skateuapp"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow SkateU on YouTube"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/40 text-white transition-colors hover:bg-white hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand motion-reduce:transition-none"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M23.5 6.19a3 3 0 0 0-2.11-2.12C19.51 3.5 12 3.5 12 3.5s-7.51 0-9.39.57A3 3 0 0 0 .5 6.19C0 8.08 0 12 0 12s0 3.92.5 5.81a3 3 0 0 0 2.11 2.12c1.88.57 9.39.57 9.39.57s7.51 0 9.39-.57a3 3 0 0 0 2.11-2.12C24 15.92 24 12 24 12s0-3.92-.5-5.81ZM9.55 15.57V8.43L15.82 12l-6.27 3.57Z" />
              </svg>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
