// ── Layout ratios ──────────────────────────────────────────────
export const MARGIN_RATIO = 0.04;
export const BAR_PAD_RATIO = 0.02;
export const FONT_SIZE_HEIGHT_RATIO = 0.04;
export const FONT_SIZE_WIDTH_RATIO = 0.025;
export const MIN_FONT_SIZE = 16;
export const MAX_FONT_SIZE = 40;
export const WAVEFORM_WIDTH_RATIO = 0.45;
export const WAVEFORM_HEIGHT_RATIO = 0.1;
export const WAVEFORM_HEIGHT_MIN_RATIO = 0.05;
export const WAVEFORM_MIN_W = 300;
export const WAVEFORM_MAX_W = 900;
export const WAVEFORM_MAX_H = 200;
export const CAPTION_GAP = 12;
export const DEFAULT_OVERLAY_Y = 0.62;

// ── Caption char cap ───────────────────────────────────────────
// Average proportional-font char width as a fraction of fontSize. 0.55
// is conservative for bold text with border rendering and accounts for
// mixed-case Latin glyphs.
export const CHAR_WIDTH_RATIO = 0.55;
export const MIN_CAPTION_CHARS = 20;
export const MAX_CAPTION_CHARS = 45;

// ── Calculation functions ──────────────────────────────────────

export function computeFontSize(
  outputWidth: number,
  outputHeight: number,
): number {
  const byHeight = Math.round(outputHeight * FONT_SIZE_HEIGHT_RATIO);
  const byWidth = Math.round(outputWidth * FONT_SIZE_WIDTH_RATIO);
  return Math.max(
    MIN_FONT_SIZE,
    Math.min(MAX_FONT_SIZE, Math.min(byHeight, byWidth)),
  );
}

/**
 * Maximum number of characters that fit comfortably in a caption bar of
 * the given pixel width at the given font size, clamped to a sensible
 * range so we never produce single-word captions or absurdly long ones.
 */
export function computeMaxChars(barW: number, fontSize: number): number {
  const fromWidth = Math.floor(barW / (fontSize * CHAR_WIDTH_RATIO));
  return Math.max(MIN_CAPTION_CHARS, Math.min(MAX_CAPTION_CHARS, fromWidth));
}

export function computeWaveformDimensions(
  outputWidth: number,
  outputHeight: number,
): { w: number; h: number } {
  const w = Math.max(
    WAVEFORM_MIN_W,
    Math.min(WAVEFORM_MAX_W, Math.round(outputWidth * WAVEFORM_WIDTH_RATIO)),
  );
  const h = Math.max(
    Math.round(outputHeight * WAVEFORM_HEIGHT_MIN_RATIO),
    Math.min(WAVEFORM_MAX_H, Math.round(outputHeight * WAVEFORM_HEIGHT_RATIO)),
  );
  return { w, h };
}

export type VideoLayout = {
  fontSize: number;
  margin: number;
  barPadX: number;
  barW: number;
  textY: number;
  waveformY: number;
  waveformW: number;
  waveformH: number;
  zoneTop: number;
  zoneBottom: number;
  zoneHeight: number;
};

/**
 * Compute all layout positions for a video of the given dimensions.
 *
 * @param overlayY - Vertical center of the caption area as a ratio
 *                   of output height (0 = top, 1 = bottom).
 *                   Default 0.62 matches the legacy hardcoded position.
 */
export function computeLayout(
  outputWidth: number,
  outputHeight: number,
  overlayY: number = DEFAULT_OVERLAY_Y,
): VideoLayout {
  const fontSize = computeFontSize(outputWidth, outputHeight);
  const margin = Math.round(outputWidth * MARGIN_RATIO);
  const barPadX = Math.round(outputWidth * BAR_PAD_RATIO);
  const barW = outputWidth - margin * 2;

  const textY = Math.round(outputHeight * overlayY);

  const { w: waveformW, h: waveformH } = computeWaveformDimensions(
    outputWidth,
    outputHeight,
  );
  const waveformY = textY - CAPTION_GAP - waveformH;

  const captionAreaHeight = Math.round(fontSize * 2.2);
  const zoneTop = waveformY;
  const zoneBottom = textY + captionAreaHeight;
  const zoneHeight = zoneBottom - zoneTop;

  return {
    fontSize,
    margin,
    barPadX,
    barW,
    textY,
    waveformY,
    waveformW,
    waveformH,
    zoneTop,
    zoneBottom,
    zoneHeight,
  };
}
