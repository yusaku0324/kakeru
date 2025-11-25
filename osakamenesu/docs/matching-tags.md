# Matching tag catalog

Canonical list of matching-related tags used across backend + frontend. Field names appear as snake_case in API contracts and camelCase in TS/DB models.

## mood_tag / moodTag
- Purpose: captures therapist atmosphere; influences vibe alignment in matching.
- Options: `calm`, `energetic`, `mature`, `friendly`.
- Source: therapist profile fields and matching preference inputs.
- Scoring: contributes to `moodFit` (weight 0.15) when guest preferences include weights for these tags.

## style_tag / styleTag
- Purpose: massage/therapy style intensity.
- Options: `relax`, `strong`, `exciting`.
- Source: therapist profile fields and matching preference inputs.
- Scoring: contributes to `styleFit` (weight 0.1) using guest style preferences.

## look_type / lookType
- Purpose: visual/character vibe for therapist presentation.
- Options: `cute`, `oneesan`, `beauty`, `gal`, `natural`, `cool`.
- Source: therapist profile fields and matching preference inputs.
- Scoring: contributes to `lookFit` (weight 0.05) using guest look preferences.

## talk_level / talkLevel
- Purpose: expected talkativeness during a session.
- Options: `quiet`, `normal`, `talkative`.
- Source: therapist profile fields and matching preference inputs.
- Scoring: contributes to `talkFit` (weight 0.1) when guest talk preferences are provided.

## contact_style / contactStyle
- Purpose: communication/booking strictness preference.
- Options: `strict`, `standard`, `relaxed`.
- Source: therapist profile fields and admin inputs.
- Scoring: not currently weighted; exposed for display and future use.

## hobby_tags / hobbyTags
- Purpose: free-form interests for vibe/context and future recommendations.
- Options: free-form string list.
- Source: therapist profile fields.
- Scoring: not currently weighted; may be used in recommendations (e.g., similar-therapist) later.
