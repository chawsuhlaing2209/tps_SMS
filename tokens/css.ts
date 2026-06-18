/**
 * @deprecated Use `npm run tokens:build` instead.
 * Kept for backwards compatibility — prints semantic colors only.
 */
import { buildDesignCss } from "./build.js";

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(buildDesignCss());
}
