import type { Decorator } from "@storybook/react";

/** Wide enough for list rows and filter groups in Storybook. */
export const pdsCanvasDecorator: Decorator = (Story) => (
  <div
    style={{
      width: "min(100%, 42rem)",
      padding: "1.5rem",
      background: "var(--pds-background-frame)",
    }}
  >
    <Story />
  </div>
);
