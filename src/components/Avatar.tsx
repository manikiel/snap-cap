import type { AvatarSpec } from "../data/types";
import { defaultAvatar } from "../data/types";
export function Avatar({
  spec = defaultAvatar,
  className = "",
}: {
  spec?: AvatarSpec;
  className?: string;
}) {
  const a = spec;
  return (
    <svg
      className={`avatar ${className}`}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={undefined} />
      </defs>
      <circle cx="50" cy="50" r="50" fill={a.background} />
      <path d="M11 100q3-32 39-32t39 32" fill={a.shirt} />
      <path d="M41 61h18v16q-9 8-18 0" fill={a.skin} />
      {a.style === "long" && (
        <path d="M21 42q0-33 29-33t29 33v42H21" fill={a.hair} />
      )}
      <ellipse cx="50" cy="44" rx="25" ry="29" fill={a.skin} />
      <ellipse cx="25" cy="47" rx="5" ry="8" fill={a.skin} />
      <ellipse cx="75" cy="47" rx="5" ry="8" fill={a.skin} />
      {a.style === "bun" && (
        <>
          <circle cx="51" cy="14" r="14" fill={a.hair} />
          <path
            d="M24 41V26Q25 12 50 12t26 16v14L65 28q-18 7-32 0Z"
            fill={a.hair}
          />
        </>
      )}
      {a.style === "crop" && (
        <path
          d="M24 39V27Q30 9 50 11q24 0 26 20v10l-8-15q-17 6-35 0Z"
          fill={a.hair}
        />
      )}{" "}
      {a.style === "waves" && (
        <path
          d="M24 39q-7-17 8-22 5-16 19-8 20-8 25 11 9 10-1 21l-9-18q-15 13-32 7Z"
          fill={a.hair}
        />
      )}{" "}
      {a.style === "long" && (
        <path
          d="M24 39Q21 11 50 11q30 0 26 30l-9-18q-12 13-34 11Z"
          fill={a.hair}
        />
      )}
      <g stroke="#332820" strokeWidth="2.5" strokeLinecap="round" fill="none">
        <path d="M35 39l8-1M57 38l8 1" />
        {a.eyes === "happy" ? (
          <path d="M35 47q4-5 8 0M57 47q4-5 8 0" />
        ) : a.eyes === "sleepy" ? (
          <path d="M35 47h8M57 47h8" />
        ) : (
          <>
            <path d="M39 46v3M61 46v3" />
          </>
        )}
        <path d="M48 51l-1 5h5M40 61q10 8 20 0" />
      </g>
      {a.accessory === "glasses" && (
        <g fill="none" stroke="#333" strokeWidth="2.5">
          <rect x="29" y="41" width="19" height="14" rx="5" />
          <rect x="52" y="41" width="19" height="14" rx="5" />
          <path d="M48 46h4" />
        </g>
      )}
      {a.accessory === "earrings" && (
        <g fill="#f3cf61">
          <circle cx="24" cy="54" r="4" />
          <circle cx="76" cy="54" r="4" />
        </g>
      )}
    </svg>
  );
}
