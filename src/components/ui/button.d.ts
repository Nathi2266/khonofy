import type * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | string;
  size?: "default" | "sm" | "lg" | "icon" | string;
  asChild?: boolean;
}

export const Button: React.ForwardRefExoticComponent<
  ButtonProps & React.RefAttributes<HTMLButtonElement>
>;

export function buttonVariants(
  props?: {
    variant?: ButtonProps["variant"];
    size?: ButtonProps["size"];
    className?: string;
  }
): string;
