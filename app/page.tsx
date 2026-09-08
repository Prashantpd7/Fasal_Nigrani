"use client";

import BigActionCard from "@/components/BigActionCard";
import FieldDecoration from "@/components/FieldDecoration";
import {
  BasketIcon,
  CameraIcon,
  ChatBubbleIcon,
  CloudRainIcon,
  GovernmentIcon,
  SproutIcon,
} from "@/components/icons";
import PageShell from "@/components/PageShell";
import { useI18n } from "@/lib/I18nProvider";

export default function HomePage() {
  const { t, dict } = useI18n();
  return (
    <PageShell fitViewport>
      <section aria-label={t("home.dailyTitle")}>
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
              href="/ask"
              accent="amber"
              compact
              icon={<ChatBubbleIcon size={26} />}
              title={t("home.chatCard.title")}
              desc={t("home.chatCard.desc")}
            />
          </div>
        </div>
      </section>

      <section aria-label={t("home.govTitle")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <BigActionCard href="/market" accent="earth" compact icon={<BasketIcon size={26} />} title={t("home.marketCard.title")} desc={t("home.marketCard.desc")} />
          <BigActionCard href="/schemes" accent="info" compact icon={<GovernmentIcon size={26} />} title={t("home.schemesCard.title")} desc={t("home.schemesCard.desc")} />
        </div>
      </section>

      <footer className="border-t border-earth/15 py-5 text-center text-[0.85rem] font-semibold text-ink-soft">
        <SproutIcon size={16} className="mx-auto mb-1 text-primary" />
        <span className="mx-auto inline-block max-w-xl">
          Fasal Nigrani ({dict.brand.hiName}) — {t("common.expertLine")}
        </span>
      </footer>
      <FieldDecoration />
    </PageShell>
  );
}
