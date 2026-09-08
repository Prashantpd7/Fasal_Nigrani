"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/I18nProvider";
import {
  ChatBubbleIcon,
  CloudRainIcon,
  HomeIcon,
  RupeeIcon,
} from "./icons";

interface Item {
  href: string;
  icon: React.ReactNode;
  label: string;
  match: (path: string) => boolean;
}

/**
 * Sticky bottom app bar (v2). Keeps the four essential destinations one tap
 * away — nothing is ever hidden behind a hamburger (§9). Uses the same token
 * colours; the active tab is the primary green with a tap-friendly 56px hit
 * area.
 */
export default function NavBar() {
  const { t } = useI18n();
  const path = usePathname();
  const items: Item[] = [
    {
      href: "/",
      icon: <HomeIcon size={22} />,
      label: t("nav.home"),
      match: (p) => p === "/",
    },
    {
      href: "/weather",
      icon: <CloudRainIcon size={22} />,
      label: t("nav.weather"),
      match: (p) => p.startsWith("/weather"),
    },
    {
      href: "/market",
      icon: <RupeeIcon size={22} />,
      label: t("nav.market"),
      match: (p) => p.startsWith("/market"),
    },
    {
      href: "/chat",
      icon: <ChatBubbleIcon size={22} />,
      label: t("nav.chat"),
      match: (p) => p.startsWith("/chat"),
    },
  ];

  return (
    <nav
      aria-label={t("nav.mainNav")}
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-[600px] items-stretch justify-between border-t border-earth/20 bg-surface/95 px-2 py-1.5 backdrop-blur-sm lg:hidden"
    >
      {items.map((item) => {
        const active = item.match(path);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-14 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-2xl text-[0.78rem] font-bold transition-colors ${
              active ? "bg-primary text-white" : "text-ink-soft hover:bg-primary-light/50"
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}