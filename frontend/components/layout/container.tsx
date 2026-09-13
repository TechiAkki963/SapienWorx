import { cn } from "@/lib/cn";

type ContainerProps = React.HTMLAttributes<HTMLDivElement>;

export function Container({ className, ...props }: ContainerProps) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[var(--content-max)] px-[var(--page-gutter)]", className)}
      {...props}
    />
  );
}
