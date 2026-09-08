"use client";

interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  emoji?: string;
}

/** Toggleable pill chip used for commodity / state / category filters. */
export default function FilterChip({
  label,
  active,
  onClick,
  emoji,
}: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`filter-chip ${
        active
          ? "bg-primary text-white"
          : "border border-earth/30 bg-surface text-ink hover:bg-earth-light/60"
      }`}
    >
      {emoji ? <span aria-hidden="true">{emoji}</span> : null}
      {label}
    </button>
  );
}