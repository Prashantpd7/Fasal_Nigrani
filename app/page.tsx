"use client";

import Header from "@/components/Header";
import NavBar from "@/components/NavBar";
import BigActionCard from "@/components/BigActionCard";
import {
  CameraIcon,
  ChatBubbleIcon,
  CloudRainIcon,
  GovernmentIcon,
  InfoIcon,
  RupeeIcon,
  SearchIcon,
  SoilIcon,
  SproutIcon,
} from "@/components/icons";
import { useI18n } from "@/lib/I18nProvider";

/**
 * Homepage v2 (§6, §9): the three core actions stay as large tappable tiles
 * and the new live government services (mandi prices, soil testing, gov
 * schemes) get their own grid — nothing is hidden behind a hamburger.
 */
export default function HomePage() {
  const { t, dict } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-[600px] flex-1 flex-col gap-4 px-4 pb-24 pt-4">
        {/* Hero */}
        <section className="rounded-3xl bg-primary-light p-5 sm:p-6">
          <h1 className="text-[1.7rem] font-extrabold leading-tight tracking-tight text-ink sm:text-[1.95rem]">
            {t("home.heroTitle")}
          </h1>
          <p className="mt-2 text-[1rem] leading-relaxed text-ink-soft">
            {t("home.heroSub")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="chip bg-primary-light text-primary">
              <CloudRainIcon size={15} /> {t("home.metricWeather")}
            </span>
            <span className="chip bg-earth-light text-earth">
              <RupeeIcon size={15} /> {t("home.metricMandi")}
            </span>
            <span className="chip bg-info-light text-info">
              <GovernmentIcon size={15} /> {t("home.metricSchemes")}
            </span>
          </div>
        </section>

        {/* Core daily tools */}
        <section aria-label={t("home.dailyTitle")}>
          <h2 className="section-head">
            <SproutIcon size={19} className="text-primary" />
            {t("home.dailyTitle")}
          </h2>
          <div className="flex flex-col gap-3">
            <BigActionCard
              href="/weather"
              accent="blue"
              icon={<CloudRainIcon size={28} />}
              title={t("home.weatherCard.title")}
              desc={t("home.weatherCard.desc")}
            />
            <div className="grid grid-cols-2 gap-3">
              <BigActionCard
                href="/photo-check"
                accent="green"
                compact
                icon={<CameraIcon size={26} />}
                title={t("home.photoCard.title")}
                desc={t("home.photoCard.desc")}
              />
              <BigActionCard
                href="/chat"
                accent="amber"
                compact
                icon={<ChatBubbleIcon size={26} />}
                title={t("home.chatCard.title")}
                desc={t("home.chatCard.desc")}
              />
            </div>
          </div>
        </section>

        {/* Government services — live data */}
        <section aria-label={t("home.govTitle")}>
          <h2 className="section-head">
            <GovernmentIcon size={19} className="text-primary" />
            {t("home.govTitle")}
            <span className="gov-src">
              <SearchIcon size={12} />
              {t("home.liveBadge")}
            </span>
          </h2>
          <p className="mt-1 text-[0.92rem] leading-relaxed text-ink-soft">
            {t("home.govSub")}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <BigActionCard
              href="/market"
              accent="earth"
              compact
              icon={<RupeeIcon size={26} />}
              title={t("home.marketCard.title")}
              desc={t("home.marketCard.desc")}
            />
            <BigActionCard
              href="/soil"
              accent="earth"
              compact
              icon={<SoilIcon size={26} />}
              title={t("home.soilCard.title")}
              desc={t("home.soilCard.desc")}
            />
            <BigActionCard
              href="/schemes"
              accent="info"
              compact
              icon={<GovernmentIcon size={26} />}
              title={t("home.schemesCard.title")}
              desc={t("home.schemesCard.desc")}
            />
          </div>
        </section>

        {/* Honest-safety note */}
        <section className="flex items-start gap-3 rounded-2xl border border-info/25 bg-info-light p-4">
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

        <footer className="text-center text-[0.85rem] font-semibold text-ink-soft">
          <SproutIcon size={16} className="mx-auto mb-1 text-primary" />
          Fasal Nigrani ({dict.brand.hiName}) — {t("common.expertLine")}
        </footer>
      </main>
      <NavBar />
    </div>
  );
}
