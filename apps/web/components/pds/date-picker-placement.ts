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

export type PlacementConstraints = {
  /** Cap available space below the anchor (e.g. modal footer). */
  maxSpaceBelow?: number;
  /** Cap available space above the anchor. */
  maxSpaceAbove?: number;
};

function fitsHorizontally(left: number, width: number, viewportWidth: number) {
  return left >= VIEWPORT_PADDING && left + width <= viewportWidth - VIEWPORT_PADDING;
}

/** Pick left/right/center placement and clamp within the viewport. */
export function computeDatePickerPlacement(
  anchorRect: DOMRect,
  panelWidth: number,
  panelHeight: number,
  preferredVertical: DatePickerVerticalAlign | "auto" = "auto",
  constraints?: PlacementConstraints
): DatePickerPlacement {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxWidth = Math.max(240, viewportWidth - VIEWPORT_PADDING * 2);
  const effectiveWidth = Math.min(Math.max(panelWidth, 1), maxWidth);
  const maxHeight = Math.max(200, viewportHeight - VIEWPORT_PADDING * 2);
  const effectiveHeight = Math.min(Math.max(panelHeight, 1), maxHeight);

  let spaceBelow = viewportHeight - VIEWPORT_PADDING - (anchorRect.bottom + ANCHOR_GAP);
  let spaceAbove = anchorRect.top - ANCHOR_GAP - VIEWPORT_PADDING;
  if (constraints?.maxSpaceBelow !== undefined) {
    spaceBelow = Math.min(spaceBelow, Math.max(0, constraints.maxSpaceBelow));
  }
  if (constraints?.maxSpaceAbove !== undefined) {
    spaceAbove = Math.min(spaceAbove, Math.max(0, constraints.maxSpaceAbove));
  }
  const vertical: DatePickerVerticalAlign =
    preferredVertical !== "auto"
      ? preferredVertical
      : spaceBelow >= effectiveHeight || spaceBelow >= spaceAbove
        ? "bottom"
        : "top";

  const availableHeight = vertical === "bottom" ? spaceBelow : spaceAbove;
  const panelMaxHeight = Math.min(maxHeight, Math.max(availableHeight, 120));

  const top =
    vertical === "bottom"
      ? anchorRect.bottom + ANCHOR_GAP
      : anchorRect.top - ANCHOR_GAP - Math.min(effectiveHeight, panelMaxHeight);

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
    Math.min(top, viewportHeight - VIEWPORT_PADDING - Math.min(effectiveHeight, panelMaxHeight))
  );

  return {
    top: clampedTop,
    left,
    maxWidth,
    maxHeight: panelMaxHeight,
    vertical,
    horizontal,
  };
}
