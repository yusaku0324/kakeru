import { test } from "@playwright/test";

test.describe.skip("matching tags", () => {
  // Placeholder for UI wiring in feat/matching-profile-tags-ui-v1.
  test("tags are rendered on therapist cards when present", async () => {
    // Navigate to matching flow and assert mood/style/look/contact/hobby tags
    // appear alongside therapist info once the UI branch is connected.
  });

  test("tag edits propagate to matching results", async () => {
    // Outline: update tags on a profile, trigger a matching search, and
    // verify the refreshed cards reflect the edited tags.
  });
});
