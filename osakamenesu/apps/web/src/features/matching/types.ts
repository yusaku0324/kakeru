export type BudgetLevel = "low" | "mid" | "high";
export type PriceLevel = "value" | "standard" | "premium";

export type GuestPreference = {
  area?: string;
  budgetLevel?: BudgetLevel;
  timeSlot?: { date: string; from: string; to: string };
  moodPref?: Partial<Record<"calm" | "energetic" | "mature", number>>;
  talkPref?: Partial<Record<"quiet" | "normal" | "talkative", number>>;
  stylePref?: Partial<Record<"relax" | "strong" | "exciting", number>>;
  lookPref?: Partial<
    Record<"cute" | "oneesan" | "beauty" | "gal" | "natural" | "cool", number>
  >;
};

export type TherapistProfile = {
  id: string;
  name?: string;
  shopId?: string;
  lookType?: "cute" | "oneesan" | "beauty" | "gal" | "natural" | "cool";
  moodTag?: "calm" | "energetic" | "mature" | "friendly";
  talkLevel?: "quiet" | "normal" | "talkative";
  styleTag?: "relax" | "strong" | "exciting";
  priceLevel?: PriceLevel;
  contactStyle?: "strict" | "standard" | "relaxed";
  hobbyTags?: string[];
};

export type MatchingBreakdown = {
  core: number;
  priceFit: number;
  moodFit: number;
  talkFit: number;
  styleFit: number;
  lookFit: number;
  availability: number;
};

export type MatchingResult = {
  therapistId: string;
  score: number;
  breakdown: MatchingBreakdown;
};
