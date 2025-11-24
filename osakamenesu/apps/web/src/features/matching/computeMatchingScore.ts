import {
  GuestPreference,
  MatchingResult,
  PriceLevel,
  TherapistProfile,
} from "./types";

type FitInput = {
  guest: GuestPreference;
  therapist: TherapistProfile;
};

const priceOrder: PriceLevel[] = ["value", "standard", "premium"];

function normalizeScore(value?: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function computePriceFit({ guest, therapist }: FitInput): number {
  if (!guest.budgetLevel || !therapist.priceLevel) return 0.5;
  const budgetIndex = priceOrder.indexOf(
    guest.budgetLevel === "low"
      ? "value"
      : guest.budgetLevel === "mid"
        ? "standard"
        : "premium",
  );
  const priceIndex = priceOrder.indexOf(therapist.priceLevel);
  if (budgetIndex < 0 || priceIndex < 0) return 0.5;
  const diff = Math.abs(budgetIndex - priceIndex);
  if (diff === 0) return 1;
  if (diff === 1) return 0.6;
  return 0.3;
}

function computeChoiceFit(
  pref: Record<string, number> | undefined,
  tag: string | undefined,
): number {
  if (!pref || !tag) return 0.5;
  const weight = pref[tag] ?? 0;
  return normalizeScore(weight);
}

export function computeMatchingScore(args: {
  guest: GuestPreference;
  therapist: TherapistProfile;
  availabilityScore: number; // 0〜1
  coreScore: number; // 0〜1 （エリア/時間/基本条件のマッチ度）
}): MatchingResult {
  const { guest, therapist, availabilityScore, coreScore } = args;

  const priceFit = computePriceFit({ guest, therapist });
  const moodFit = computeChoiceFit(guest.moodPref ?? {}, therapist.moodTag);
  const talkFit = computeChoiceFit(guest.talkPref ?? {}, therapist.talkLevel);
  const styleFit = computeChoiceFit(guest.stylePref ?? {}, therapist.styleTag);
  const lookFit = computeChoiceFit(guest.lookPref ?? {}, therapist.lookType);

  const score =
    0.4 * normalizeScore(coreScore) +
    0.15 * normalizeScore(priceFit) +
    0.15 * normalizeScore(moodFit) +
    0.1 * normalizeScore(talkFit) +
    0.1 * normalizeScore(styleFit) +
    0.05 * normalizeScore(lookFit) +
    0.05 * normalizeScore(availabilityScore);

  return {
    therapistId: therapist.id,
    score,
    breakdown: {
      core: normalizeScore(coreScore),
      priceFit: normalizeScore(priceFit),
      moodFit: normalizeScore(moodFit),
      talkFit: normalizeScore(talkFit),
      styleFit: normalizeScore(styleFit),
      lookFit: normalizeScore(lookFit),
      availability: normalizeScore(availabilityScore),
    },
  };
}
