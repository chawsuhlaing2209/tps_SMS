/** Returns true when the event target is an interactive control inside a clickable row. */
export function isPadaukRowInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(
      "button, a, input, select, textarea, label, [data-row-stop], [role='menu'], [role='menuitem']"
    )
  );
}
