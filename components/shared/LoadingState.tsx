"use client";

import { SproutIcon } from "../icons";

interface Props {
  message: string;
  detail?: string;
}

/** Every async action shows a contextual message, never a bare spinner (§9). */
export default function LoadingState({ message, detail }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="card flex flex-col items-center gap-3 py-10 text-center"
    >
      <span className="attention-pulse flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-primary">
        <SproutIcon size={30} />
      </span>
      <p className="text-[1.15rem] font-bold text-ink">{message}</p>
      {detail ? (
        <p className="text-[0.95rem] text-ink-soft">{detail}</p>
      ) : null}
    </div>
  );
}
