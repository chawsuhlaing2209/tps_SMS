"use client";

import { Fragment, useEffect, useRef } from "react";
import { Icon } from "../../app/lib/material-icon";
import { cn } from "../../lib/utils";

export type StepperStep = {
  id: string;
  label: string;
};

export type StepperProps = {
  steps: StepperStep[];
  /** Zero-based index of the current step. */
  currentStep: number;
  /** When set, completed steps become clickable for back navigation. */
  onStepClick?: (index: number) => void;
  ariaLabel: string;
  className?: string;
  /** Ceremony modal stepper — compact nodes with trailing connectors (Figma 127:16774). */
  variant?: "default" | "ceremony";
};

export function Stepper({ steps, currentStep, onStepClick, ariaLabel, className, variant = "default" }: StepperProps) {
  const ceremony = variant === "ceremony";
  const navRef = useRef<HTMLElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!ceremony) return;
    const activeStep = stepRefs.current[currentStep];
    const nav = navRef.current;
    if (!activeStep || !nav) return;
    const navRect = nav.getBoundingClientRect();
    const stepRect = activeStep.getBoundingClientRect();
    const offset =
      stepRect.left - navRect.left - navRect.width / 2 + stepRect.width / 2;
    nav.scrollTo({ left: nav.scrollLeft + offset, behavior: "smooth" });
  }, [ceremony, currentStep]);

  return (
    <nav
      ref={navRef}
      className={cn("stepper", ceremony && "stepper--ceremony", className)}
      aria-label={ariaLabel}
    >
      {steps.map((step, index) => {
        const done = index < currentStep;
        const active = index === currentStep;
        const clickable = Boolean(onStepClick && done);

        const nodeClass = cn(
          "stepper__node",
          done && "stepper__node--done",
          active && "stepper__node--active",
          !done && !active && "stepper__node--upcoming",
          ceremony && done && "stepper__node--ceremony-done",
          ceremony && active && "stepper__node--ceremony-active",
          ceremony && !done && !active && "stepper__node--ceremony-upcoming",
        );

        const labelClass = cn(
          "stepper__label",
          done && "stepper__label--done",
          active && "stepper__label--active",
          !done && !active && "stepper__label--upcoming",
          ceremony && "stepper__label--ceremony",
          ceremony && !done && !active && "stepper__label--ceremony-upcoming",
        );

        const nodeContent = done ? <Icon name="check" size={16} /> : index + 1;
        const connectorDone = ceremony ? index < currentStep : index <= currentStep;

        return (
          <Fragment key={step.id}>
            {!ceremony && index > 0 ? (
              <span
                className={cn("stepper__connector", connectorDone && "stepper__connector--done")}
                aria-hidden
              />
            ) : null}
            <div
              className="stepper__step"
              ref={(element) => {
                stepRefs.current[index] = element;
              }}
            >
              {clickable ? (
                <button type="button" className={nodeClass} onClick={() => onStepClick?.(index)}>
                  {nodeContent}
                </button>
              ) : (
                <span className={nodeClass} aria-current={active ? "step" : undefined}>
                  {nodeContent}
                </span>
              )}
              <span className={labelClass}>{step.label}</span>
              {ceremony ? (
                <span
                  className={cn(
                    "stepper__connector stepper__connector--ceremony",
                    connectorDone && "stepper__connector--done",
                  )}
                  aria-hidden
                />
              ) : null}
            </div>
          </Fragment>
        );
      })}
    </nav>
  );
}
