import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-[hsl(211_100%_62%)] to-[hsl(217_90%_50%)] text-white shadow-[0_4px_20px_hsl(211_100%_55%/0.35),inset_0_1px_0_hsl(0_0%_100%/0.25)] hover:brightness-110",
        secondary:
          "bg-muted/80 text-foreground shadow-[inset_0_1px_0_hsl(210_100%_90%/0.06)] hover:bg-muted",
        outline:
          "border border-[hsl(217_80%_60%/0.25)] bg-muted/40 backdrop-blur hover:bg-muted/60",
        ghost: "hover:bg-muted/60",
        destructive:
          "bg-gradient-to-b from-[hsl(0_80%_58%)] to-[hsl(0_70%_45%)] text-white shadow-[0_4px_20px_hsl(0_80%_50%/0.3)] hover:brightness-110",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-6",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";
