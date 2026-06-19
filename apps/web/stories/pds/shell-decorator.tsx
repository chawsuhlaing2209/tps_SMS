import type { Decorator } from "@storybook/react";

/** Ink-green shell surface for DetailCard and on-dark buttons. */
export const pdsShellDecorator: Decorator = (Story) => (
  <div
    style={{
      width: "min(100%, 74rem)",
      padding: "1.5rem",
      background: "var(--pds-background-frame)",
    }}
  >
    <Story />
  </div>
);
