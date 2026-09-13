import Link from "next/link";

import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

type CommonProps = {
  children: React.ReactNode;
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

type LinkButtonProps = CommonProps & {
  href: string;
  type?: never;
  disabled?: never;
};

type NativeButtonProps = CommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & {
    href?: never;
  };

type ButtonProps = LinkButtonProps | NativeButtonProps;

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-indigo text-white shadow-card hover:-translate-y-0.5 hover:bg-violet-ink active:translate-y-0 disabled:pointer-events-none disabled:opacity-50",
  secondary:
    "border border-line bg-white/90 text-ink shadow-sm hover:-translate-y-0.5 hover:border-indigo/30 hover:bg-lavender/45 active:translate-y-0",
  ghost: "text-ink hover:bg-indigo-soft/45 active:bg-indigo-soft/70",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3.5 text-sm",
  md: "min-h-11 px-5 text-sm",
  lg: "min-h-12 px-6 text-base",
};

export function Button(props: ButtonProps) {
  const { children, className, variant = "primary", size = "md" } = props;
  const styles = cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition duration-200 focus-visible:outline-none",
    variants[variant],
    sizes[size],
    className,
  );

  if ("href" in props && props.href) {
    return (
      <Link className={styles} href={props.href}>
        {children}
      </Link>
    );
  }

  const { className: _className, children: _children, size: _size, variant: _variant, ...nativeProps } =
    props as NativeButtonProps;

  return (
    <button className={styles} {...nativeProps}>
      {children}
    </button>
  );
}
