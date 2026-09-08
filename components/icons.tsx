import type { SVGProps } from "react";

/**
 * Hand-rolled, high-contrast icon set (§10). Icons are simple shapes (filled
 * where meaningful) so they read instantly at small sizes on low-end phones.
 * Everything uses currentColor; colour is never the only signal (each icon is
 * always accompanied by text labels, §15).
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 24, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...rest,
  };
}

export const SunIcon = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <circle cx="12" cy="12" r="5" />
    <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M19.4 4.6l-1.7 1.7M6.3 17.7l-1.7 1.7" />
    </g>
  </svg>
);

const cloudPath = "M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z";

export const CloudIcon = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d={cloudPath} />
  </svg>
);

const RainDrops = () => (
  <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M6.5 19.5v3M11.5 19.5v3M16.5 19.5v3" />
  </g>
);

export const CloudRainIcon = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M17.5 16.5H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    <RainDrops />
  </svg>
);

export const CloudSnowIcon = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M17.5 16.5H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    <g fill="currentColor">
      <circle cx="7" cy="19.8" r="0.8" />
      <circle cx="11.6" cy="21.6" r="0.8" />
      <circle cx="16.2" cy="19.4" r="0.8" />
    </g>
  </svg>
);

export const CloudFogIcon = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M17.5 15H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M5.5 19h13M7 22h10" />
    </g>
  </svg>
);

export const CloudLightningIcon = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M17.5 16H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    <path d="M13 15.5 9.5 21h2.4L10.6 25" transform="translate(0,-2) scale(0.94)" />
  </svg>
);

export const CloudSunIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d={cloudPath} fill="currentColor" stroke="none" transform="translate(0,3) scale(0.92)" />
    <circle cx="8.2" cy="7.6" r="2.6" fill="currentColor" stroke="none" />
    <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M8.2 2.4v1.5M8.2 11.3v1.5M3.1 7.6h1.5M11.8 7.6h1.5M4.5 3.9l1 1M10.9 10.3l1 1M11.9 3.9l-1 1M5.5 10.3l-1 1" />
    </g>
  </svg>
);

export const DropletIcon = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M12 2.6c.5 0 5.9 6.9 5.9 11.1a5.9 5.9 0 1 1-11.8 0C6.1 9.5 11.5 2.6 12 2.6Z" />
  </svg>
);

export const LeafIcon = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M6 21c.5-9 4.5-16.5 13.5-16.5C20 13.5 15 21 6 21Z" />
    <path
      d="M6 21c2.5-4 6.5-7.5 10.5-9"
      stroke="var(--color-bg)"
      strokeWidth="1.8"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

export const SproutIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 20h10" />
    <path d="M10 20c5.5-2.5.8-6.4 3-10" />
    <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8Z" />
    <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.3.1-4 .6-4.9 2Z" />
  </svg>
);

export const BeetleIcon = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M12 6.8a8.2 8.2 0 0 0-4.6 1.4C5 9.6 3.8 12 3.8 14.4c0 3.9 3.7 6.8 8.2 6.8s8.2-2.9 8.2-6.8c0-2.4-1.2-4.8-3.6-6.2A8.2 8.2 0 0 0 12 6.8Z" />
    <circle cx="12" cy="15" r="2.4" />
    <path
      d="M7.4 11.2c-1.7-1-2.6-2-3.4-4M16.6 11.2c1.7-1 2.6-2 3.4-4M9.6 7.2C8.8 4.8 8 3.6 6.8 2.6M14.4 7.2c.8-2.4 1.6-3.6 2.8-4.6"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

export const BoltIcon = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.4L13 2Z" />
  </svg>
);

export const CameraIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path
      d="M4 7.5h3.2L8.6 5.3h6.8l1.4 2.2H20a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2Z"
      fill="currentColor"
      stroke="none"
    />
    <circle cx="12" cy="13.4" r="3.6" fill="var(--color-bg)" stroke="none" />
    <circle cx="12" cy="13.4" r="1.7" fill="currentColor" stroke="none" />
  </svg>
);

export const ImageIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <circle cx="9" cy="9" r="1.6" />
    <path d="m21 15-4.5-4.5L7 20" />
  </svg>
);

export const ChatBubbleIcon = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M12 3C6.5 3 2 6.9 2 11.7c0 3.5 2.3 6.6 5.9 8l-1 3.3 4.3-2.1c.3 0 .5.1.8.1 5.5 0 10-3.9 10-8.7S17.5 3 12 3Z" />
  </svg>
);

export const MicIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);

export const SendIcon = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M21.3 2.7 12 12M21.3 2.7 15 21.4l-3-9.4-9.4-3L21.3 2.7Z" />
  </svg>
);

export const MapPinIcon = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M12 2a7 7 0 0 0-7 7c0 5.2 6.2 12.6 6.7 13.2a.55.55 0 0 0 .82 0c.4-.6 6.6-8 6.6-13.2a7 7 0 0 0-7-7Zm0 9.4a2.4 2.4 0 1 1 0-4.8 2.4 2.4 0 0 1 0 4.8Z" />
  </svg>
);

export const WarningIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

export const InfoIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 7.5h.01" />
  </svg>
);

export const AlertTriangleIcon = WarningIcon;

export const WarningCircleIcon = AlertTriangleIcon;

export const CheckIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const XIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export const ArrowLeftIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

export const ChevronRightIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const RefreshIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
  </svg>
);

export const SearchIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

export const QuestionIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9a2.6 2.6 0 1 1 3.8 2.3c-.8.5-1.3 1-1.3 2.2M12 17h.01" />
  </svg>
);

export const HomeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m3 11 9-8 9 8" />
    <path d="M5 9.5V21h14V9.5" />
  </svg>
);

export const WindIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 8h9a3 3 0 1 0-2.6-4.5" />
    <path d="M3 12h13a3 3 0 1 1-2.6 4.5M3 16h6.5" />
  </svg>
);
