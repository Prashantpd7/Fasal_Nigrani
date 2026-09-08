"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LanguageSwitcher from "./LanguageSwitcher";
import {
  CameraIcon,
  ChatBubbleIcon,
  CloudRainIcon,
  GovernmentIcon,
  HomeIcon,
  RupeeIcon,
  SoilIcon,
  SproutIcon,
} from "./icons";
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

interface NavItem {
  href: string;
  icon: React.ReactNode;
  label: string;
  match: (path: string) => boolean;
}

/**
 * Header v3 — a real application bar:
 *  - sticky full-width top bar
 *  - brand (left)
 *  - desktop navigation (Home, Weather, Photo, Ask, Mandi, Soil, Schemes)
 *    — icons on tablet, icon+label on desktop, hidden on mobile (bottom nav)
 *  - language switcher (right)
 */
export default function Header() {
  const { t } = useI18n();
  const path = usePathname();

  const nav: NavItem[] = [
    {
      href: "/",
      icon: <HomeIcon size={20} />,
      label: t("nav.home"),
      match: (p) => p === "/",
    },
    {
      href: "/weather",
      icon: <CloudRainIcon size={20} />,
      label: t("nav.weather"),
      match: (p) => p.startsWith("/weather"),
    },
    {
      href: "/photo-check",
      icon: <CameraIcon size={20} />,
      label: t("nav.photo"),
      match: (p) => p.startsWith("/photo-check"),
    },
    {
      href: "/chat",
      icon: <ChatBubbleIcon size={20} />,
      label: t("nav.chat"),
      match: (p) => p.startsWith("/chat"),
    },
    {
      href: "/market",
      icon: <RupeeIcon size={20} />,
      label: t("nav.market"),
      match: (p) => p.startsWith("/market"),
    },
    {
      href: "/soil",
      icon: <SoilIcon size={20} />,
      label: t("nav.soil"),
      match: (p) => p.startsWith("/soil"),
    },
    {
      href: "/schemes",
      icon: <GovernmentIcon size={20} />,
      label: t("nav.schemes"),
      match: (p) => p.startsWith("/schemes"),
    },
  ];

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <BrandMark />

        <nav
          aria-label={t("nav.mainNav")}
          className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto md:flex"
        >
          {nav.map((item) => {
            const active = item.match(path);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`nav-link whitespace-nowrap ${
                  active
                    ? "bg-primary text-white shadow-sm"
                    : "text-ink-soft hover:bg-primary-light/50 hover:text-ink"
                }`}
              >
                <span className="shrink-0">{item.icon}</span>
                <span className="hidden xl:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <LanguageSwitcher />
      </div>
    </header>
  );
}
