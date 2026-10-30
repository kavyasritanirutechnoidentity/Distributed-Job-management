import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-border bg-muted/60 text-muted-foreground",
        success:
          "border-success/40 bg-success/10 text-success shadow-[0_0_12px_hsl(160_84%_45%/0.25),inset_0_1px_0_hsl(0_0%_100%/0.08)]",
        warning:
          "border-warning/40 bg-warning/10 text-warning shadow-[0_0_12px_hsl(38_95%_55%/0.25),inset_0_1px_0_hsl(0_0%_100%/0.08)]",
        destructive:
          "border-destructive/40 bg-destructive/10 text-destructive shadow-[0_0_12px_hsl(0_80%_58%/0.3),inset_0_1px_0_hsl(0_0%_100%/0.08)]",
        info: "border-primary/40 bg-primary/10 text-primary shadow-[0_0_12px_hsl(211_100%_62%/0.25),inset_0_1px_0_hsl(0_0%_100%/0.08)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
