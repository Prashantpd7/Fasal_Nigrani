"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import Header from "./Header";
import NavBar from "./NavBar";
import { ArrowLeftIcon } from "./icons";
import { useI18n } from "@/lib/I18nProvider";

interface PageShellProps {
  title?: string;
  subtitle?: string;
  backHref?: string;
  children: ReactNode;
}

/**
 * Responsive application shell (v3). The container expands to the full
 * viewport (capped at 1280px) on desktop, so pages become real dashboards
 * instead of a 600px mobile column. On mobile the back button and bottom nav
 * keep the one-tap navigation philosophy. Every feature page uses this shell,
 * so header / width / rhythm / typography stay identical app-wide.
 */
export default function PageShell({
  title,
  subtitle,
  backHref,
  children,
}: PageShellProps) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <Header />
      <main className="app-main">
        {title ? (
          <div className="flex flex-col gap-3">
            {backHref ? (
              <Link
                href={backHref}
                className="inline-flex h-11 w-fit cursor-pointer items-center gap-1.5 rounded-full px-3 text-[0.95rem] font-semibold text-primary hover:bg-primary-light/60 lg:hidden"
              >
                <ArrowLeftIcon size={18} />
                {t("common.back")}
              </Link>
            ) : null}
            <h1 className="page-title">{title}</h1>
            {subtitle ? (
              <p className="page-subtitle">{subtitle}</p>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-col gap-4">{children}</div>
      </main>
      <NavBar />
    </div>
  );
}
