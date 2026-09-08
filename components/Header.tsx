"use client";

import Link from "next/link";
import LanguageSwitcher from "./LanguageSwitcher";
import { SproutIcon } from "./icons";
import { useI18n } from "@/lib/I18nProvider";

/** Brand wordmark — always "Fasal Nigrani" with the Devanagari name alongside. */
export function BrandMark({ href = "/" }: { href?: string } = {}) {
  const { lang } = useI18n();
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-2xl pr-2"
      aria-label="Fasal Nigrani — home"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-white">
        <SproutIcon size={26} />
      </span>
      <span className="flex flex-col leading-tight text-left">
        <span className="text-[1.15rem] font-extrabold tracking-tight text-ink">
          Fasal Nigrani
        </span>
        <span
          className={`text-[0.8rem] font-semibold ${
            lang === "hi" ? "text-primary" : "text-earth"
          }`}
        >
          {lang === "hi" ? "फसल निगरानी" : "Crop Monitoring"}
        </span>
      </span>
    </Link>
  );
}

export default function Header() {

  return (
    <header className="app-header">
      <div className="app-header-inner flex-wrap py-2">
        <BrandMark />
        <LanguageSwitcher />
      </div>
    </header>
  );
}
