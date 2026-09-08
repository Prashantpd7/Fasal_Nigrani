"use client";

import Header from "@/components/Header";
import BigActionCard from "@/components/BigActionCard";
import {
  CloudRainIcon,
  CameraIcon,
  ChatBubbleIcon,
  InfoIcon,
  SproutIcon,
} from "@/components/icons";
import { useI18n } from "@/lib/I18nProvider";

/**
 * Homepage (§6, §9): the three core actions are always visible as large
 * tappable tiles — no hamburger-only navigation. Roadmap items are clearly
 * disabled "coming soon" stubs (§6) so the demo can gesture at scope.
 */
export default function HomePage() {
  const { t, dict } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-[600px] flex-1 flex-col px-4 pb-14 pt-5">
        {/* Hero */}
        <section className="rounded-3xl bg-primary-light p-5 sm:p-6">
          <h1 className="text-[1.9rem] font-extrabold leading-tight tracking-tight text-ink sm:text-[2.15rem]">
            {t("home.heroTitle")}
          </h1>
          <p className="mt-2 text-[1.04rem] leading-relaxed text-ink-soft">
            {t("home.heroSub")}
          </p>
        </section>

        {/* Three core actions */}
        <div className="mt-5 flex flex-col gap-3">
          <BigActionCard
            href="/weather"
            accent="blue"
            icon={<CloudRainIcon size={28} />}
            title={t("home.weatherCard.title")}
            desc={t("home.weatherCard.desc")}
          />
          <BigActionCard
            href="/photo-check"
            accent="green"
            icon={<CameraIcon size={28} />}
            title={t("home.photoCard.title")}
            desc={t("home.photoCard.desc")}
          />
          <BigActionCard
            href="/chat"
            accent="amber"
            icon={<ChatBubbleIcon size={28} />}
            title={t("home.chatCard.title")}
            desc={t("home.chatCard.desc")}
          />
        </div>

        {/* Roadmap (disabled, future scope only §6) */}
        <section className="mt-6" aria-label={t("home.soonTitle")}>
          <h2 className="mb-2 text-[0.95rem] font-extrabold uppercase tracking-wide text-ink-soft">
            {t("home.soonTitle")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {dict.home.soonItems.map((item) => (
              <span
                key={item}
                className="chip cursor-not-allowed border border-dashed border-earth/30 bg-surface text-ink-soft"
              >
                {item}
              </span>
            ))}
          </div>
        </section>

        {/* Honest-safety note */}
        <section className="mt-6 flex items-start gap-3 rounded-2xl border border-info/25 bg-info-light p-4">
          <span className="mt-0.5 shrink-0 text-info">
            <InfoIcon size={22} />
          </span>
          <div>
            <h2 className="text-[1rem] font-extrabold text-ink">
              {t("home.noteTitle")}
            </h2>
            <p className="mt-0.5 text-[0.95rem] leading-relaxed text-ink">
              {t("home.note")}
            </p>
          </div>
        </section>

        <footer className="mt-auto pt-8 text-center text-[0.85rem] font-semibold text-ink-soft">
          <SproutIcon size={16} className="mx-auto mb-1 text-primary" />
          Fasal Nigrani ({dict.brand.hiName}) — {t("common.expertLine")}
        </footer>
      </main>
    </div>
  );
}
