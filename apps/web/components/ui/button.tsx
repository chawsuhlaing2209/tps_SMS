import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

/** Figma Button: type × color × state (enabled/hover/disabled via CSS). */
const buttonVariants = cva(
  "pds-btn inline-flex items-center justify-center whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pds-states-focus)] disabled:pointer-events-none disabled:cursor-not-allowed",
  {
    variants: {
      buttonType: {
        filled: "pds-btn--filled",
        outlined: "pds-btn--outlined",
      },
      buttonColor: {
        primary: "pds-btn--primary",
        secondary: "pds-btn--secondary",
      },
      surface: {
        light: "",
        dark: "pds-btn--on-dark",
      },
      variant: {
        default: "",
        destructive:
          "pds-btn--destructive bg-[var(--pds-status-error)] text-[var(--pds-text-invert-primary)] hover:bg-[var(--pds-color-red-danger-strong)] border-transparent",
        outline: "",
        ghost: "",
        link: "pds-btn--link h-auto min-h-0 p-0 border-0 bg-transparent text-[var(--pds-foreground-link)] underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-[var(--pds-padding-medium)] text-[var(--pds-type-body-s-bold-font-size)]",
        default: "",
        lg: "h-10 px-[var(--pds-padding-x-large)]",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      buttonType: "filled",
      buttonColor: "primary",
      surface: "light",
      variant: "default",
      size: "default",
    },
  }
);

export type ButtonType = "filled" | "outlined";
export type ButtonColor = "primary" | "secondary";
export type ButtonSurface = "light" | "dark";

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Figma `type` — filled or outlined. */
  buttonType?: ButtonType;
  /** Figma `color` — primary or secondary. */
  buttonColor?: ButtonColor;
  /** Light canvas (default) or dark shell surfaces (outlined on-dark tokens). */
  surface?: ButtonSurface;
}

function resolveFigmaButton(
  variant: ButtonProps["variant"],
  buttonType?: ButtonType,
  buttonColor?: ButtonColor
): { type: ButtonType; color: ButtonColor; legacyClass?: string } {
  if (variant === "destructive" || variant === "link") {
    return { type: "filled", color: "primary" };
  }

  const type: ButtonType =
    buttonType ?? (variant === "outline" || variant === "ghost" ? "outlined" : "filled");
  const color: ButtonColor = buttonColor ?? "primary";

  const legacyClass =
    variant === "default"
      ? "btn-primary"
      : variant === "outline" || variant === "ghost"
        ? "btn-ghost"
        : undefined;

  return { type, color, legacyClass };
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      type = "button",
      size,
      surface = "light",
      buttonType,
      buttonColor,
      asChild = false,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    const figma = resolveFigmaButton(variant, buttonType, buttonColor);
    const useFigmaStyles = variant !== "destructive" && variant !== "link";

    return (
      <Comp
        className={cn(
          buttonVariants({
            buttonType: useFigmaStyles ? figma.type : undefined,
            buttonColor: useFigmaStyles ? figma.color : undefined,
            surface: useFigmaStyles ? surface : undefined,
            variant,
            size,
          }),
          useFigmaStyles ? figma.legacyClass : undefined,
          className
        )}
        ref={ref}
        type={asChild ? undefined : type}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
