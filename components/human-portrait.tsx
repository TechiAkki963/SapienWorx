import styles from "./human-portrait.module.css";

type HumanPortraitProps = {
  role?: "candidate" | "recruiter" | "manager" | "consultant" | "company" | "referral";
  className?: string;
  compact?: boolean;
};

const palette = {
  candidate: { skin: "#E9B89D", hair: "#17233F", shirt: "#D89B59", accent: "#4463FF" },
  recruiter: { skin: "#D9A483", hair: "#10223C", shirt: "#315A52", accent: "#6C63FF" },
  manager: { skin: "#C98E6D", hair: "#1B253B", shirt: "#243C52", accent: "#20B59A" },
  consultant: { skin: "#D7A17F", hair: "#1E2435", shirt: "#344B72", accent: "#3B82F6" },
  company: { skin: "#E2AD8C", hair: "#37283B", shirt: "#D56F56", accent: "#F18F5B" },
  referral: { skin: "#E8B094", hair: "#2A2030", shirt: "#B46A4D", accent: "#F24F7D" },
} as const;

export function HumanPortrait({ role = "candidate", className = "", compact = false }: HumanPortraitProps) {
  const colors = palette[role];
  return (
    <div className={`${styles.frame} ${styles[role]} ${compact ? styles.compact : ""} ${className}`.trim()} aria-hidden="true">
      <svg viewBox="0 0 520 520" role="presentation" focusable="false">
        <defs>
          <linearGradient id={`blob-${role}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#DDE6FF" />
            <stop offset="55%" stopColor="#DDF7F0" />
            <stop offset="100%" stopColor="#FFE8DC" />
          </linearGradient>
        </defs>
        <path className={styles.blob} d="M96 162c18-81 109-131 192-116 94 18 163 99 153 191-9 88-89 162-177 175-92 13-191-41-209-125-9-43 10-88 41-125Z" fill={`url(#blob-${role})`} />
        <g className={styles.signal} fill="none" stroke={colors.accent} strokeLinecap="round">
          <path d="M73 258c-12-92 49-181 138-211 78-26 167 2 217 68" />
          <path d="M96 273c-9-73 40-143 109-166 62-21 133 1 173 54" />
          <path d="M122 285c-7-54 31-106 83-123 47-16 100 1 130 40" />
          <path d="M148 294c-5-37 22-74 58-86 33-11 69 1 90 28" />
        </g>
        <g className={styles.person}>
          <path d="M195 226c0-73 41-119 103-119 58 0 101 39 107 103 4 43-7 80-31 111-19 26-48 41-78 41-35 0-64-18-83-48-12-19-18-49-18-88Z" fill={colors.skin} />
          <path d="M195 225c-4-72 39-131 108-131 65 0 104 40 111 101-21-13-42-29-56-51-26 29-74 45-136 44-8 12-14 25-18 37l-9 0Z" fill={colors.hair} />
          <path d="M213 285c6 39 37 72 81 72 43 0 74-27 84-64-10 73-5 99 42 122H164c50-22 56-54 49-130Z" fill={colors.shirt} />
          <path d="M253 257c16 10 43 10 59 0" fill="none" stroke="#9A5C4F" strokeWidth="4" strokeLinecap="round" />
          <circle cx="251" cy="225" r="5" fill="#18213A" />
          <circle cx="333" cy="225" r="5" fill="#18213A" />
          <path d="M282 232c-4 18-4 31 6 40" fill="none" stroke="#B47763" strokeWidth="4" strokeLinecap="round" />
        </g>
        <g className={styles.nodes} fill={colors.accent}>
          <circle cx="108" cy="207" r="6" /><circle cx="135" cy="154" r="5" /><circle cx="413" cy="150" r="6" />
        </g>
      </svg>
    </div>
  );
}
