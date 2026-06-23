/** Figma Input states: enabled, hovered (CSS), disabled, completed, error. */
export type InputState = "enabled" | "disabled" | "completed" | "error";

export function inputStateClass(state: InputState | undefined, disabled?: boolean): string {
  if (disabled || state === "disabled") return "form-input--disabled";
  if (state === "error") return "form-input--error";
  if (state === "completed") return "form-input--completed";
  return "";
}

export function resolveInputState(
  explicit: InputState | undefined,
  disabled?: boolean,
  hasError?: boolean
): InputState {
  if (disabled || explicit === "disabled") return "disabled";
  if (hasError || explicit === "error") return "error";
  if (explicit === "completed") return "completed";
  return explicit ?? "enabled";
}
