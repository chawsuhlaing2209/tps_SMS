import { Preview } from "@storybook/react";
import { NextIntlClientProvider } from "next-intl";
import en from "../messages/en.json";
import "../app/globals.css";
import "./fonts.css";

const preview: Preview = {
  decorators: [
    (Story) => (
      <NextIntlClientProvider locale="en" messages={en}>
        <div className="padauk-storybook-canvas">
          <Story />
        </div>
      </NextIntlClientProvider>
    ),
  ],
  parameters: {
    layout: "padded",
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    backgrounds: {
      default: "canvas",
      values: [
        { name: "canvas", value: "var(--pds-background-frame)" },
        { name: "dark", value: "var(--pds-primary)" },
      ],
    },
  },
};

export default preview;
