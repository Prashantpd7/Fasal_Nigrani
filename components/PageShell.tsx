"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import Header from "./Header";
import { ArrowLeftIcon } from "./icons";
import { useI18n } from "@/lib/I18nProvider";

interface PageShellProps {
  title?: string;
  subtitle?: string;
  fitViewport?: boolean;
  /** When true, renders ONLY the children (used by the single-page
   *  dashboard to embed a feature in place). */
  embedded?: boolean;
  children: ReactNode;
}

/**
 * Responsive application shell (v5). Minimal: sticky top bar (brand +
 * language) over a full-width content area (capped at 1280px). No bottom nav.
 * When `embedded` is true only the children are rendered — used by the
 * single-page dashboard to open each feature in place.
 */
export default function PageShell({
  title,
  subtitle,
  fitViewport = false,
  embedded = false,
  children,
}: PageShellProps) {
  const { t } = useI18n();
  if (embedded) {
    return <div className="flex flex-col gap-4">{children}</div>;
  }
  return (
    <div className={`flex min-h-dvh flex-col bg-bg ${fitViewport ? "h-dvh overflow-hidden" : ""}`}>
      <Header />
      <main className="app-main">
        {title ? (
          <header className="flex flex-col gap-3">
            <Link
              href="/"
              className="inline-flex min-h-9 w-fit items-center gap-1.5 rounded-full px-3 text-sm font-bold text-ink-soft transition-colors hover:bg-primary-light hover:text-ink"
            >
              <ArrowLeftIcon size={17} />
              {t("common.back")}
            </Link>
            <h1 className="page-title">{title}</h1>
            {subtitle ? (
              <p className="page-subtitle">{subtitle}</p>
            ) : null}
          </header>
        ) : null}
        <div className="flex flex-col gap-4">{children}</div>
      </main>
    </div>
  );
}
