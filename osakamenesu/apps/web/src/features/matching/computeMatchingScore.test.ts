import { describe, expect, it } from "vitest";

import { computeMatchingScore } from "./computeMatchingScore";
import type { GuestPreference, TherapistProfile } from "./types";

describe("computeMatchingScore", () => {
  const baseGuest: GuestPreference = {
    budgetLevel: "mid",
    moodPref: { calm: 1, energetic: 0.2 },
    talkPref: { quiet: 0.8, normal: 0.5, talkative: 0.2 },
    stylePref: { relax: 0.9, strong: 0.4 },
    lookPref: { natural: 0.8, beauty: 0.7 },
  };

  it("returns high score when core and preferences match", () => {
    const therapist: TherapistProfile = {
      id: "t1",
      priceLevel: "standard",
      moodTag: "calm",
      talkLevel: "quiet",
      styleTag: "relax",
      lookType: "natural",
    };

    const result = computeMatchingScore({
      guest: baseGuest,
      therapist,
      coreScore: 1,
      availabilityScore: 1,
    });

    expect(result.score).toBeGreaterThan(0.75);
    expect(result.breakdown.priceFit).toBeCloseTo(1);
    expect(result.breakdown.moodFit).toBeCloseTo(1);
  });

  it("penalizes when budget does not align", () => {
    const therapist: TherapistProfile = {
      id: "t2",
      priceLevel: "premium",
      moodTag: "calm",
      talkLevel: "quiet",
      styleTag: "relax",
    };

    const aligned = computeMatchingScore({
      guest: baseGuest,
      therapist: { ...therapist, priceLevel: "standard" },
      coreScore: 1,
      availabilityScore: 1,
    });

    const result = computeMatchingScore({
      guest: { ...baseGuest, budgetLevel: "low" },
      therapist,
      coreScore: 1,
      availabilityScore: 1,
    });

    expect(result.breakdown.priceFit).toBeLessThan(0.5);
    expect(result.score).toBeLessThan(aligned.score);
  });

  it("handles missing prefs by falling back to neutral scores", () => {
    const therapist: TherapistProfile = {
      id: "t3",
      priceLevel: "standard",
    };

    const result = computeMatchingScore({
      guest: {},
      therapist,
      coreScore: 0.8,
      availabilityScore: 0.7,
    });

    expect(result.breakdown.moodFit).toBeCloseTo(0.5);
    expect(result.breakdown.priceFit).toBeCloseTo(0.5);
    expect(result.score).toBeGreaterThan(0.3);
  });
});
