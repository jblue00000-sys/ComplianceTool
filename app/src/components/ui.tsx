"use client";

import type { ReactNode } from "react";
import type { AccessMode, Band } from "@/lib/types";

/** Token colour for each verdict band. */
export const BAND_COLOR: Record<Band, string> = {
  green: "var(--color-good)",
  amber: "var(--color-warn)",
  red: "var(--color-bad)",
};

/** Token colour and label for each access mode. */
export const ACCESS_MODE: Record<AccessMode, { color: string; label: string }> = {
  read: { color: "var(--color-good)", label: "Reads" },
  write: { color: "var(--color-warn)", label: "Changes" },
  irreversible: { color: "var(--color-bad)", label: "Cannot be undone" },
};

/**
 * Authority is inverted against the other measures: a high number is dangerous,
 * not healthy, so it never borrows the standing palette.
 */
export function authorityColor(score: number): string {
  if (score > 70) return "var(--color-bad)";
  if (score > 45) return "var(--color-warn)";
  return "var(--color-good)";
}

export function Kicker({ children }: { children: ReactNode }) {
  return <span className="kicker">{children}</span>;
}

export function PageHeading({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-5">
      <Kicker>{kicker}</Kicker>
      <h2 className="mt-2 mb-1 text-2xl font-bold tracking-tight">{title}</h2>
      {children ? (
        <p className="m-0 max-w-[800px] text-sm text-(--color-mute)">{children}</p>
      ) : null}
    </header>
  );
}

export function Panel({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border border-(--color-line) bg-(--color-panel) ${className}`}
    >
      {children}
    </div>
  );
}

/** A thin horizontal score bar. */
export function Meter({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1b2436]">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
      />
    </div>
  );
}

export function Badge({
  band,
  children,
}: {
  band: Band;
  children: ReactNode;
}) {
  const tone: Record<Band, string> = {
    green: "bg-[rgba(47,191,135,0.16)] text-[#5fdcaa]",
    amber: "bg-[rgba(240,180,41,0.16)] text-[#f5c860]",
    red: "bg-[rgba(244,97,107,0.16)] text-[#ff8b93]",
  };
  return (
    <span
      className={`inline-block rounded-md px-2 py-1.5 font-mono text-[10px] font-bold tracking-wider uppercase ${tone[band]}`}
    >
      {children}
    </span>
  );
}

/** A small outlined chip used for systems and tools. */
export function Chip({
  mode,
  children,
}: {
  mode?: AccessMode;
  children: ReactNode;
}) {
  const tone =
    mode === "irreversible"
      ? "border-[#6b2c34] text-[#ff8b93] bg-[rgba(244,97,107,0.09)]"
      : mode === "write"
        ? "border-[#6b5a25] text-[#f5c860] bg-[rgba(240,180,41,0.08)]"
        : "border-(--color-line-2) text-(--color-mute)";
  return (
    <span className={`rounded-md border px-2 py-1.5 font-mono text-[11px] ${tone}`}>
      {children}
    </span>
  );
}

/** Two-word initials for an avatar tile. */
export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
}

export function Avatar({ name, band }: { name: string; band: Band }) {
  return (
    <div
      className="grid size-9.5 shrink-0 place-items-center rounded-[10px] text-sm font-extrabold text-[#06101d]"
      style={{
        background: `linear-gradient(140deg, ${BAND_COLOR[band]}, var(--color-accent))`,
      }}
    >
      {initials(name)}
    </div>
  );
}

/** Circular score gauge used on summary surfaces. */
export function Gauge({
  value,
  size = 120,
  suffix = "OF 100",
}: {
  value: number;
  size?: number;
  suffix?: string;
}) {
  const r = 48;
  const circumference = 2 * Math.PI * r;
  const colour =
    value >= 70 ? BAND_COLOR.green : value >= 50 ? BAND_COLOR.amber : BAND_COLOR.red;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className="shrink-0">
      <circle cx="60" cy="60" r={r} fill="none" stroke="#1b2436" strokeWidth="11" />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke={colour}
        strokeWidth="11"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - value / 100)}
        transform="rotate(-90 60 60)"
      />
      <text x="60" y="58" textAnchor="middle" fontSize="27" fontWeight="800" fill="#e9eff9">
        {value}
      </text>
      <text x="60" y="76" textAnchor="middle" fontSize="9" fill="#65788f" fontFamily="ui-monospace, monospace">
        {suffix}
      </text>
    </svg>
  );
}
