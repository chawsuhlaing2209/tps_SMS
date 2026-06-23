export type DatePickerHorizontalAlign = "start" | "end" | "center";
export type DatePickerVerticalAlign = "top" | "bottom";

export type DatePickerPlacement = {
  top: number;
  left: number;
  maxWidth: number;
  maxHeight: number;
  vertical: DatePickerVerticalAlign;
  horizontal: DatePickerHorizontalAlign;
};

const VIEWPORT_PADDING = 12;
const ANCHOR_GAP = 8;

function fitsHorizontally(left: number, width: number, viewportWidth: number) {
  return left >= VIEWPORT_PADDING && left + width <= viewportWidth - VIEWPORT_PADDING;
}

/** Pick left/right/center placement and clamp within the viewport. */
export function computeDatePickerPlacement(
  anchorRect: DOMRect,
  panelWidth: number,
  panelHeight: number
): DatePickerPlacement {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxWidth = Math.max(240, viewportWidth - VIEWPORT_PADDING * 2);
  const effectiveWidth = Math.min(Math.max(panelWidth, 1), maxWidth);
  const maxHeight = Math.max(200, viewportHeight - VIEWPORT_PADDING * 2);
  const effectiveHeight = Math.min(Math.max(panelHeight, 1), maxHeight);

  const spaceBelow = viewportHeight - VIEWPORT_PADDING - (anchorRect.bottom + ANCHOR_GAP);
  const spaceAbove = anchorRect.top - ANCHOR_GAP - VIEWPORT_PADDING;
  const vertical: DatePickerVerticalAlign =
    spaceBelow >= effectiveHeight || spaceBelow >= spaceAbove ? "bottom" : "top";

  const top =
    vertical === "bottom"
      ? anchorRect.bottom + ANCHOR_GAP
      : anchorRect.top - ANCHOR_GAP - effectiveHeight;

  const startLeft = anchorRect.left;
  const endLeft = anchorRect.right - effectiveWidth;
  const anchorCenterLeft = anchorRect.left + anchorRect.width / 2 - effectiveWidth / 2;
  const viewportCenterLeft = viewportWidth / 2 - effectiveWidth / 2;

  let horizontal: DatePickerHorizontalAlign = "start";
  let left = startLeft;

  if (fitsHorizontally(startLeft, effectiveWidth, viewportWidth)) {
    horizontal = "start";
    left = startLeft;
  } else if (fitsHorizontally(endLeft, effectiveWidth, viewportWidth)) {
    horizontal = "end";
    left = endLeft;
  } else if (fitsHorizontally(anchorCenterLeft, effectiveWidth, viewportWidth)) {
    horizontal = "center";
    left = anchorCenterLeft;
  } else if (fitsHorizontally(viewportCenterLeft, effectiveWidth, viewportWidth)) {
    horizontal = "center";
    left = viewportCenterLeft;
  } else {
    horizontal = "center";
    left = Math.max(
      VIEWPORT_PADDING,
      Math.min(startLeft, viewportWidth - VIEWPORT_PADDING - effectiveWidth)
    );
  }

  const clampedTop = Math.max(
    VIEWPORT_PADDING,
    Math.min(top, viewportHeight - VIEWPORT_PADDING - effectiveHeight)
  );

  return {
    top: clampedTop,
    left,
    maxWidth,
    maxHeight,
    vertical,
    horizontal,
  };
}
