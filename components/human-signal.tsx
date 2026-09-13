import styles from "./human-signal.module.css";

type HumanSignalProps = {
  tone?: "candidate" | "recruiter" | "neutral";
  compact?: boolean;
  className?: string;
};

export function HumanSignal({ tone = "candidate", compact = false, className = "" }: HumanSignalProps) {
  return (
    <div
      className={`${styles.signal} ${styles[tone]} ${compact ? styles.compact : ""} ${className}`.trim()}
      aria-hidden="true"
    >
      <svg viewBox="0 0 640 520" role="presentation" focusable="false">
        <g className={styles.fingerprint} fill="none" stroke="currentColor" strokeLinecap="round">
          <path d="M110 318c-32-92 8-194 91-242 85-49 192-27 251 45" />
          <path d="M139 333c-29-76 2-163 72-204 72-42 164-24 214 37" />
          <path d="M170 343c-24-60 0-128 55-160 56-33 128-18 168 29" />
          <path d="M202 347c-18-44 0-92 39-115 40-23 91-12 119 22" />
          <path d="M232 342c-10-28 2-58 27-73 26-15 59-8 77 14" />
          <path d="M151 241c-9 84 30 158 104 198" />
          <path d="M190 216c-6 69 26 129 84 160" />
          <path d="M231 205c-4 49 18 91 59 113" />
        </g>
        <g className={styles.bridge} fill="none" stroke="currentColor" strokeLinecap="round">
          <path d="M318 328C388 328 402 278 458 278h72" />
          <path d="M292 378c83 0 96 48 166 48h95" />
          <path d="M337 254c54 0 69-54 124-54h70" />
        </g>
        <g className={styles.nodes} fill="currentColor">
          <circle cx="458" cy="278" r="7" />
          <circle cx="530" cy="278" r="10" />
          <circle cx="458" cy="426" r="7" />
          <circle cx="553" cy="426" r="10" />
          <circle cx="461" cy="200" r="7" />
          <circle cx="531" cy="200" r="10" />
        </g>
        <g className={styles.cards} fill="none" stroke="currentColor">
          <rect x="430" y="102" width="120" height="64" rx="12" />
          <path d="M450 124h65M450 143h42" />
          <rect x="472" y="302" width="136" height="76" rx="12" />
          <path d="M493 327h73M493 348h49" />
        </g>
      </svg>
    </div>
  );
}
