type AnnotationProps = {
  variant: "human" | "progress";
  className?: string;
};

/**
 * Resolution-independent decorative calligraphy. No words are baked into
 * photos; hide from assistive technology because the annotations add no task
 * information and are repeated by the surrounding prose.
 */
export function HumanAnnotation({ variant, className = "" }: AnnotationProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 165 115"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g fill="#071d49" fontFamily="Georgia, 'Times New Roman', serif" fontSize="19" fontStyle="italic">
        {variant === "human" ? (
          <>
            <text x="13" y="29">A more</text>
            <text x="13" y="55">human way</text>
            <text x="13" y="81">to work</text>
          </>
        ) : (
          <>
            <text x="13" y="29">Progress</text>
            <text x="13" y="55">looks good</text>
            <text x="13" y="81">on you.</text>
          </>
        )}
      </g>
      <path d="M15 99C34 90 46 94 57 90" stroke="#0866ff" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
