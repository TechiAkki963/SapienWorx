import type { CSSProperties, ReactNode } from "react";
import styles from "./ui-v1-primitives.module.css";

export function RowListItem({ mark, title, meta, action }: { mark?: ReactNode; title: ReactNode; meta?: ReactNode; action?: ReactNode }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowMark}>{mark ?? "•"}</div>
      <div className={styles.rowBody}>
        <div className={styles.rowTitle}>{title}</div>
        {meta ? <div className={styles.rowMeta}>{meta}</div> : null}
      </div>
      {action ? <div className={styles.rowAction}>{action}</div> : null}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className={styles.empty}>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function MatchChipSet({ items }: { items: Array<{ label: string; tone?: "hit" | "good" | "neutral" }> }) {
  return (
    <div className={styles.chips} aria-label="Match details">
      {items.map((item) => {
        const className = item.tone === "hit" ? `${styles.chip} ${styles.chipHit}` : item.tone === "good" ? `${styles.chip} ${styles.chipGood}` : styles.chip;
        return <span className={className} key={item.label}>{item.label}</span>;
      })}
    </div>
  );
}

export function StatusStepper({ steps, currentIndex }: { steps: string[]; currentIndex: number }) {
  const style = { "--step-count": steps.length } as CSSProperties;
  return (
    <div className={styles.stepper} style={style} aria-label="Application progress">
      {steps.map((label, index) => {
        const complete = index < currentIndex;
        const current = index === currentIndex;
        const className = complete ? `${styles.step} ${styles.stepComplete}` : current ? `${styles.step} ${styles.stepCurrent}` : styles.step;
        return (
          <div className={className} key={label} aria-current={current ? "step" : undefined}>
            <span className={styles.circle}>{complete ? "✓" : current ? "" : index + 1}</span>
            <span className={styles.stepLabel}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}
