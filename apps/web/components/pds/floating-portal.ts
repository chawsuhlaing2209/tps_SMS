export type FloatingPortalTarget = {
  element: HTMLElement;
  /** `absolute` when portaled inside a transformed modal shell. */
  mode: "fixed" | "absolute";
};

/** Where to mount floating panels (select, date picker). Always document.body so
 *  the panel escapes any modal's `overflow: hidden` and renders at full height.
 *  Popover z-index (1000) sits above the modal (101), and the modal keeps itself
 *  open for these panels via `isModalPopoverTarget`. */
export function getFloatingPortalTarget(_anchor: HTMLElement | null): FloatingPortalTarget {
  return { element: document.body, mode: "fixed" };
}

export const PDS_Z_POPOVER = 1000;
