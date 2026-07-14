import {
  computeFontSize,
  computeLayout,
  computeMaxChars,
  MAX_CAPTION_CHARS,
  MAX_FONT_SIZE,
  MIN_CAPTION_CHARS,
  MIN_FONT_SIZE,
} from "@app/shared";
import { describe, expect, it } from "vitest";

describe("computeFontSize", () => {
  it("returns MIN_FONT_SIZE for very small inputs", () => {
    const fs = computeFontSize(100, 100);
    expect(fs).toBe(MIN_FONT_SIZE);
  });

  it("uses the smaller of height- and width-based estimates", () => {
    // 1280x720: byHeight=29, byWidth=32 → 29
    expect(computeFontSize(1280, 720)).toBe(29);
    // 1080x1080: byHeight=43, byWidth=27 → 27
    expect(computeFontSize(1080, 1080)).toBe(27);
  });

  it("caps at MAX_FONT_SIZE for huge inputs", () => {
    // 3840x2160: byHeight=86, byWidth=96 → capped to MAX_FONT_SIZE
    expect(computeFontSize(3840, 2160)).toBe(MAX_FONT_SIZE);
    expect(MAX_FONT_SIZE).toBe(40);
  });
});

describe("computeMaxChars", () => {
  it("returns MIN_CAPTION_CHARS for very narrow bars", () => {
    const mc = computeMaxChars(50, 16);
    expect(mc).toBe(MIN_CAPTION_CHARS);
    expect(MIN_CAPTION_CHARS).toBe(20);
  });

  it("returns MAX_CAPTION_CHARS for very wide bars", () => {
    const mc = computeMaxChars(4000, 16);
    expect(mc).toBe(MAX_CAPTION_CHARS);
    expect(MAX_CAPTION_CHARS).toBe(45);
  });

  it("derives a width-aware cap for typical video dimensions", () => {
    // 1920x1080 → fontSize=40 (capped) → barW=1766 → 1766/(40*0.55)=80
    // → clamped to MAX_CAPTION_CHARS=45
    expect(computeMaxChars(1766, 40)).toBe(45);

    // 720x1280 → fontSize=18 → barW=662 → 662/(18*0.55)=66
    // → clamped to MAX_CAPTION_CHARS=45
    expect(computeMaxChars(662, 18)).toBe(45);

    // 360x640 → fontSize=16 → barW=331 → 331/(16*0.55)=37
    expect(computeMaxChars(331, 16)).toBe(37);
  });

  it("shrinks when the font size grows", () => {
    const narrow = computeMaxChars(1000, 24);
    const wide = computeMaxChars(1000, 48);
    expect(wide).toBeLessThan(narrow);
  });
});

describe("computeLayout", () => {
  it("exposes a clamped fontSize", () => {
    const layout = computeLayout(3840, 2160);
    expect(layout.fontSize).toBeLessThanOrEqual(MAX_FONT_SIZE);
  });
});
