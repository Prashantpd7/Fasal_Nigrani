"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import Header from "./Header";
import { ArrowLeftIcon } from "./icons";
import { useI18n } from "@/lib/I18nProvider";

interface PageShellProps {
  title: string;
  subtitle?: string;
  backHref: string;
  children: ReactNode;
}

/**
 * Single-column, mobile-first shell (§10): content is capped at ~600px and
 * centered even on desktop — never a dashboard grid. Every feature page is
 * ≤2 taps from the homepage (§9).
 */
export default function PageShell({
  title,
  subtitle,
  backHref,
  children,
}: PageShellProps) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-[600px] flex-1 flex-col px-4 pb-12 pt-4">
        <Link
          href={backHref}
          className="mb-3 inline-flex min-h-11 w-fit cursor-pointer items-center gap-1.5 rounded-full px-2 text-[0.95rem] font-semibold text-primary hover:bg-primary-light/60"
        >
          <ArrowLeftIcon size={18} />
          {t("common.back")}
        </Link>
        <h1 className="text-[1.65rem] font-extrabold leading-snug tracking-tight text-ink">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-[1.02rem] leading-relaxed text-ink-soft">
            {subtitle}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col gap-4">{children}</div>
      </main>
    </div>
  );
}
