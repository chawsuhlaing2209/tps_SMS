/** Ensures only one PdsSelect panel is open at a time across the page. */
let activeSelectId: string | null = null;
let closeActive: (() => void) | null = null;

export function registerOpenSelect(id: string, close: () => void) {
  if (activeSelectId !== null && activeSelectId !== id) {
    closeActive?.();
  }
  activeSelectId = id;
  closeActive = close;
}

export function unregisterOpenSelect(id: string) {
  if (activeSelectId === id) {
    activeSelectId = null;
    closeActive = null;
  }
}

/** Test helper — reset singleton state between cases. */
export function resetSelectOpenCoordinatorForTests() {
  activeSelectId = null;
  closeActive = null;
}
