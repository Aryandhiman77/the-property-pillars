// Adapted from the shadcn/ui registry button used by dashboard-01. MIT.
import {cva, type VariantProps} from "class-variance-authority";
import type {ComponentProps} from "react";
import {cn} from "@/lib/classnames";

export const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b72222] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[var(--action-fill)] text-white hover:bg-[var(--action-hover)]",
        outline: "border border-[#f2c6c3] bg-white text-[#b72222] hover:bg-[#fff0ef]",
        ghost: "text-[#b72222] hover:bg-[#fff0ef]",
      },
    },
    defaultVariants: {variant: "default"},
  },
);

export function Button({
  className,
  variant,
  type = "button",
  ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return <button type={type} className={cn(buttonVariants({variant}), className)} {...props} />;
}
