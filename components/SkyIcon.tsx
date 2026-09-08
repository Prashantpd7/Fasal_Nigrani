"use client";

import type { SkyGroup } from "@/lib/types";
import {
  CloudFogIcon,
  CloudIcon,
  CloudLightningIcon,
  CloudRainIcon,
  CloudSnowIcon,
  CloudSunIcon,
  SunIcon,
} from "./icons";

/** WMO sky-group -> icon component (groups come from the rules engine). */
export default function SkyIcon({
  group,
  size = 26,
  className,
}: {
  group: SkyGroup;
  size?: number;
  className?: string;
}) {
  const p = { size, className };
  switch (group) {
    case "clear":
      return <SunIcon {...p} />;
    case "partly":
      return <CloudSunIcon {...p} />;
    case "rain":
      return <CloudRainIcon {...p} />;
    case "storm":
      return <CloudLightningIcon {...p} />;
    case "snow":
      return <CloudSnowIcon {...p} />;
    case "fog":
      return <CloudFogIcon {...p} />;
    default:
      return <CloudIcon {...p} />;
  }
}
