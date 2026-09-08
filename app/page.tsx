"use client";

import PageShell from "@/components/PageShell";
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
 * Homepage v3 — a professional dashboard:
 *  - welcome hero with quick status chips
 *  - Weather as the large primary card
 *  - Crop Photo + AI Assistant in a 2-col grid
 *  - Mandi, Soil, Government Schemes in a responsive grid
 *  Use the full desktop width; stack on mobile.
 */
export default function HomePage() {
  const { t, dict } = useI18n();
  return (
    <PageShell>
      <>
        {/* Hero */}
        <section className="rounded-3xl bg-primary-light p-6 sm:p-8 lg:p-9">
          <h1 className="page-title">{t("home.heroTitle")}</h1>
          <p className="page-subtitle mt-1">{t("home.heroSub")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
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

        {/* Daily tools */}
        <section aria-label={t("home.dailyTitle")}>
          <h2 className="section-head">
            <SproutIcon size={19} className="text-primary" />
            {t("home.dailyTitle")}
          </h2>

          <div className="grid gap-3">
            <BigActionCard
              href="/weather"
              accent="blue"
              icon={<CloudRainIcon size={30} />}
              title={t("home.weatherCard.title")}
              desc={t("home.weatherCard.desc")}
            />

            <div className="grid gap-3 sm:grid-cols-2">
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
          <p className="mt-1 text-[0.95rem] leading-relaxed text-ink-soft">
            {t("home.govSub")}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          <div className="flex-1">
            <h2 className="text-[1rem] font-extrabold text-ink">
              {t("home.noteTitle")}
            </h2>
            <p className="mt-0.5 text-[0.95rem] leading-relaxed text-ink">
              {t("home.note")}
            </p>
          </div>
        </section>

        <footer className="border-t border-earth/15 py-5 text-center text-[0.85rem] font-semibold text-ink-soft">
          <SproutIcon size={16} className="mx-auto mb-1 text-primary" />
          <span className="mx-auto inline-block max-w-xl">
            Fasal Nigrani ({dict.brand.hiName}) — {t("common.expertLine")}
          </span>
        </footer>
      </>
    </PageShell>
  );
}
