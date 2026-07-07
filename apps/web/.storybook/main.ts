import type { StorybookConfig } from "@storybook/react-webpack5";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const storybookDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(storybookDir, "..");

const postcssLoader = {
  loader: require.resolve("postcss-loader"),
  options: {
    postcssOptions: {
      config: path.resolve(webRoot, "postcss.config.js"),
    },
  },
};

const cssLoaders = [
  require.resolve("style-loader"),
  {
    loader: require.resolve("css-loader"),
    options: { importLoaders: 1 },
  },
  postcssLoader,
];

function isCssRule(rule: unknown): boolean {
  if (!rule || typeof rule !== "object" || !("test" in rule)) return false;
  const test = (rule as { test?: RegExp }).test;
  return test instanceof RegExp && test.test("app.css");
}

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
    "@storybook/addon-a11y",
  ],
  framework: {
    name: "@storybook/react-webpack5",
    options: {},
  },
  staticDirs: ["../public"],
  webpackFinal: async (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.extensions = [
      ...(config.resolve.extensions ?? []),
      ".ts",
      ".tsx",
    ];
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": webRoot,
      "next/link": path.resolve(storybookDir, "mocks/next-link.tsx"),
    };

    const cssRule = {
      test: /\.css$/,
      sideEffects: true,
      use: cssLoaders,
    };

    config.module = config.module ?? { rules: [] };
    config.module.rules = (config.module.rules ?? []).map((rule) => {
      if (!rule || typeof rule !== "object" || !("oneOf" in rule)) return rule;
      const oneOf = Array.isArray(rule.oneOf) ? rule.oneOf : [];
      return {
        ...rule,
        oneOf: [cssRule, ...oneOf.filter((entry) => !isCssRule(entry))],
      };
    });

    config.module.rules = [
      cssRule,
      ...config.module.rules.filter((rule) => !isCssRule(rule)),
      {
        test: /\.(woff2?|eot|ttf|otf)$/i,
        type: "asset/resource",
      },
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: require.resolve("babel-loader"),
            options: {
              configFile: path.resolve(storybookDir, "babel.config.cjs"),
            },
          },
        ],
      },
    ];

    return config;
  },
};

export default config;
