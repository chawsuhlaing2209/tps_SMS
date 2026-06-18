"use client";

import { Fragment } from "react";
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
};

export function Stepper({ steps, currentStep, onStepClick, ariaLabel, className }: StepperProps) {
  return (
    <nav className={cn("stepper", className)} aria-label={ariaLabel}>
      {steps.map((step, index) => {
        const done = index < currentStep;
        const active = index === currentStep;
        const clickable = Boolean(onStepClick && done);

        const nodeClass = cn(
          "stepper__node",
          done && "stepper__node--done",
          active && "stepper__node--active",
          !done && !active && "stepper__node--upcoming"
        );

        const labelClass = cn(
          "stepper__label",
          done && "stepper__label--done",
          active && "stepper__label--active",
          !done && !active && "stepper__label--upcoming"
        );

        const nodeContent = done ? <Icon name="check" size={16} /> : index + 1;

        return (
          <Fragment key={step.id}>
            {index > 0 ? (
              <span
                className={cn("stepper__connector", index <= currentStep && "stepper__connector--done")}
                aria-hidden
              />
            ) : null}
            <div className="stepper__step">
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
            </div>
          </Fragment>
        );
      })}
    </nav>
  );
}
