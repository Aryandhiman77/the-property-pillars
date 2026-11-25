"use client";

import MuiButton from "@mui/material/Button";
import type {ComponentProps} from "react";

type Props = Omit<ComponentProps<"button">, "color"> & {variant?: "default" | "outline" | "ghost"};
const variants = {default: "contained", outline: "outlined", ghost: "text"} as const;

export function Button({variant = "default", type = "button", ...props}: Props) {
  return <MuiButton variant={variants[variant]} type={type} {...props} />;
}
