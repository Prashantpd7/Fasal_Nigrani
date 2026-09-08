import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { LanguageProvider } from "@/lib/I18nProvider";

export const metadata: Metadata = {
  title: "Fasal Nigrani — फसल निगरानी | Weather & Crop Care",
  description:
    "Fasal Nigrani (फसल निगरानी) — a farmer's companion that translates weather data and crop photos into plain-language, Hindi/English guidance for what to do in the field today.",
  applicationName: "Fasal Nigrani",
  keywords: ["kisan", "farmer", "weather", "crop", "Rajasthan", "Hindi"],
};

export const viewport: Viewport = {
  themeColor: "#2f6b3a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="hi">
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
