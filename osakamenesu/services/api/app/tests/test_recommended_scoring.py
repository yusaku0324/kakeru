"""Tests for recommended_scoring_service.py.

Tests verify that the Python implementation matches the TypeScript
recommendedScore.ts behavior.
"""

import pytest
from app.domains.site.services.recommended_scoring_service import (
    GuestIntent,
    TherapistProfile,
    clamp01,
    recommended_score,
    recommended_score_with_breakdown,
    score_candidate_legacy,
    affinity_score,
    popularity_score,
    fairness_score,
    user_fit_score,
    availability_factor,
    compute_face_tag_match_score,
    conversation_match_score,
    pressure_match_score,
    mood_match_score,
    style_match_score,
    newcomer_score,
    load_balance_score,
)


class TestClamp01:
    """Tests for clamp01 helper."""

    def test_clamp_negative(self):
        assert clamp01(-0.5) == 0.0

    def test_clamp_above_one(self):
        assert clamp01(1.5) == 1.0

    def test_clamp_in_range(self):
        assert clamp01(0.5) == 0.5

    def test_clamp_boundary_zero(self):
        assert clamp01(0.0) == 0.0

    def test_clamp_boundary_one(self):
        assert clamp01(1.0) == 1.0


class TestFaceTagMatchScore:
    """Tests for compute_face_tag_match_score."""

    def test_empty_user_tags_returns_neutral(self):
        assert compute_face_tag_match_score([], ["kawaii"]) == 0.5

    def test_empty_therapist_tags_returns_neutral(self):
        assert compute_face_tag_match_score(["kawaii"], []) == 0.5

    def test_both_empty_returns_neutral(self):
        assert compute_face_tag_match_score([], []) == 0.5

    def test_full_match(self):
        assert compute_face_tag_match_score(["kawaii"], ["kawaii"]) == 1.0

    def test_partial_match(self):
        score = compute_face_tag_match_score(["kawaii", "natural"], ["kawaii"])
        assert score == 1.0  # 1/1 = 1.0 (min of 2, 1 is 1)

    def test_no_overlap(self):
        score = compute_face_tag_match_score(["kawaii"], ["cool_beauty"])
        assert score == 0.0


class TestConversationMatchScore:
    """Tests for conversation_match_score."""

    def test_no_preference_returns_neutral(self):
        assert conversation_match_score(None, "talkative") == 0.5

    def test_exact_match(self):
        assert conversation_match_score("talkative", "talkative") == 1.0

    def test_adjacent_talkative_normal(self):
        assert conversation_match_score("talkative", "normal") == 0.7

    def test_adjacent_quiet_normal(self):
        assert conversation_match_score("quiet", "normal") == 0.7

    def test_opposite_talkative_quiet(self):
        assert conversation_match_score("talkative", "quiet") == 0.3


class TestPressureMatchScore:
    """Tests for pressure_match_score."""

    def test_no_preference_returns_neutral(self):
        assert pressure_match_score(None, "medium") == 0.5

    def test_exact_match(self):
        assert pressure_match_score("medium", "medium") == 1.0

    def test_adjacent_soft_medium(self):
        assert pressure_match_score("soft", "medium") == 0.7

    def test_opposite_soft_strong(self):
        assert pressure_match_score("soft", "strong") == 0.3


class TestMoodMatchScore:
    """Tests for mood_match_score."""

    def test_empty_preference_returns_neutral(self):
        assert mood_match_score([], ["cheerful"]) == 0.5

    def test_empty_actual_returns_neutral(self):
        assert mood_match_score(["cheerful"], []) == 0.5

    def test_full_match(self):
        score = mood_match_score(["cheerful"], ["cheerful"])
        assert score == pytest.approx(1.0, rel=1e-6)

    def test_no_overlap(self):
        score = mood_match_score(["cheerful"], ["calm"])
        assert score == 0.3


class TestStyleMatchScore:
    """Tests for style_match_score."""

    def test_all_neutral(self):
        intent = GuestIntent()
        profile = TherapistProfile(therapist_id="1")
        score = style_match_score(intent, profile)
        # All components return 0.5 when no prefs
        assert score == pytest.approx(0.5, rel=1e-6)

    def test_full_match(self):
        intent = GuestIntent(
            conversation_preference="talkative",
            massage_pressure_preference="medium",
            mood_preference_tags=["cheerful"],
        )
        profile = TherapistProfile(
            therapist_id="1",
            conversation_style="talkative",
            massage_pressure="medium",
            mood_tags=["cheerful"],
        )
        score = style_match_score(intent, profile)
        # 0.4 * 1.0 + 0.3 * 1.0 + 0.3 * 1.0 = 1.0
        assert score == pytest.approx(1.0, rel=1e-6)


class TestAffinityScore:
    """Tests for affinity_score."""

    def test_neutral_profile(self):
        intent = GuestIntent()
        profile = TherapistProfile(therapist_id="1")
        score = affinity_score(intent, profile)
        # 0.5 * 0.5 + 0.5 * 0.5 = 0.5
        assert score == pytest.approx(0.5, rel=1e-6)


class TestPopularityScore:
    """Tests for popularity_score."""

    def test_zero_stats(self):
        profile = TherapistProfile(therapist_id="1")
        score = popularity_score(profile)
        # All zeros except price_tier=1 -> tier=0
        # 0.4*0 + 0.3*0 + 0.2*0 + 0.1*0 = 0 -> sqrt(0) = 0
        # But wait, avg_review_score=0 normalizes to (0-1)/4 = -0.25 -> clamped to 0
        assert score == 0.0

    def test_high_stats(self):
        profile = TherapistProfile(
            therapist_id="1",
            total_bookings_30d=100,
            repeat_rate_30d=1.0,
            avg_review_score=5.0,
            price_tier=3,
        )
        score = popularity_score(profile)
        # b=1.0, r=1.0, rev=1.0, tier=1.0
        # raw = 0.4*1 + 0.3*1 + 0.2*1 + 0.1*1 = 1.0
        # sqrt(1.0) = 1.0
        assert score == pytest.approx(1.0, rel=1e-6)


class TestNewcomerScore:
    """Tests for newcomer_score."""

    def test_brand_new(self):
        assert newcomer_score(1) == 0.9

    def test_one_week(self):
        assert newcomer_score(7) == 0.9

    def test_two_weeks(self):
        assert newcomer_score(14) == 0.6

    def test_one_month(self):
        assert newcomer_score(30) == 0.6

    def test_three_months(self):
        assert newcomer_score(90) == 0.3

    def test_veteran(self):
        assert newcomer_score(365) == 0.1


class TestLoadBalanceScore:
    """Tests for load_balance_score."""

    def test_fully_available(self):
        assert load_balance_score(0.0) == 1.0

    def test_fully_booked(self):
        assert load_balance_score(1.0) == 0.0

    def test_half_utilized(self):
        assert load_balance_score(0.5) == 0.5


class TestFairnessScore:
    """Tests for fairness_score."""

    def test_veteran_fully_booked(self):
        profile = TherapistProfile(
            therapist_id="1",
            days_since_first_shift=365,
            utilization_7d=1.0,
        )
        score = fairness_score(profile)
        # 0.5 * 0.1 + 0.5 * 0.0 = 0.05
        assert score == pytest.approx(0.05, rel=1e-6)

    def test_newcomer_fully_available(self):
        profile = TherapistProfile(
            therapist_id="1",
            days_since_first_shift=1,
            utilization_7d=0.0,
        )
        score = fairness_score(profile)
        # 0.5 * 0.9 + 0.5 * 1.0 = 0.95
        assert score == pytest.approx(0.95, rel=1e-6)


class TestAvailabilityFactor:
    """Tests for availability_factor."""

    def test_zero_availability(self):
        factor = availability_factor(0.0)
        assert factor == pytest.approx(0.9, rel=1e-6)

    def test_full_availability(self):
        factor = availability_factor(1.0)
        assert factor == pytest.approx(1.05, rel=1e-6)

    def test_half_availability(self):
        factor = availability_factor(0.5)
        # 0.9 + (1.05 - 0.9) * 0.5 = 0.9 + 0.075 = 0.975
        assert factor == pytest.approx(0.975, rel=1e-6)


class TestUserFitScore:
    """Tests for user_fit_score."""

    def test_neutral(self):
        intent = GuestIntent()
        profile = TherapistProfile(therapist_id="1")
        score = user_fit_score(intent, profile)
        # affinity=0.5, popularity=0.0
        # 0.7 * 0.5 + 0.3 * 0.0 = 0.35
        assert score == pytest.approx(0.35, rel=1e-6)


class TestRecommendedScore:
    """Tests for recommended_score."""

    def test_neutral_profile(self):
        intent = GuestIntent()
        profile = TherapistProfile(therapist_id="1")
        score = recommended_score(intent, profile)
        # user_fit=0.35, fairness depends on defaults
        # days_since_first_shift=365 -> newcomer=0.1
        # utilization_7d=0.0 -> load=1.0
        # fairness = 0.5*0.1 + 0.5*1.0 = 0.55
        # base = 0.8*0.35 + 0.2*0.55 = 0.28 + 0.11 = 0.39
        # availability_score=0.5 -> factor=0.975
        # final = 0.39 * 0.975 = 0.38025
        assert score == pytest.approx(0.38025, rel=1e-3)

    def test_ideal_profile(self):
        intent = GuestIntent(
            visual_style_tags=["kawaii"],
            conversation_preference="talkative",
            massage_pressure_preference="medium",
            mood_preference_tags=["cheerful"],
        )
        profile = TherapistProfile(
            therapist_id="1",
            visual_style_tags=["kawaii"],
            conversation_style="talkative",
            massage_pressure="medium",
            mood_tags=["cheerful"],
            total_bookings_30d=100,
            repeat_rate_30d=1.0,
            avg_review_score=5.0,
            price_tier=3,
            days_since_first_shift=1,
            utilization_7d=0.0,
            availability_score=1.0,
        )
        score = recommended_score(intent, profile)
        # High affinity, high popularity, high fairness, high availability
        assert score > 0.9


class TestRecommendedScoreWithBreakdown:
    """Tests for recommended_score_with_breakdown."""

    def test_returns_breakdown(self):
        intent = GuestIntent()
        profile = TherapistProfile(therapist_id="1")
        breakdown = recommended_score_with_breakdown(intent, profile)

        assert hasattr(breakdown, "affinity")
        assert hasattr(breakdown, "popularity")
        assert hasattr(breakdown, "user_fit")
        assert hasattr(breakdown, "newcomer")
        assert hasattr(breakdown, "load_balance")
        assert hasattr(breakdown, "fairness")
        assert hasattr(breakdown, "availability_factor")
        assert hasattr(breakdown, "final")


class TestScoreCandidateLegacy:
    """Tests for score_candidate_legacy adapter."""

    def test_basic_usage(self):
        therapist_data = {
            "id": "123",
            "visual_style_tags": ["kawaii"],
            "conversation_style": "talkative",
        }
        guest_prefs = {
            "visual_style_tags": ["kawaii"],
            "conversation_preference": "talkative",
        }

        result = score_candidate_legacy(
            therapist_data,
            guest_prefs,
            core_score=0.8,
            availability_score=0.7,
        )

        assert "score" in result
        assert "breakdown" in result
        assert result["breakdown"]["core"] == 0.8

    def test_empty_inputs(self):
        result = score_candidate_legacy({}, None)
        assert "score" in result
        assert isinstance(result["score"], float)

    def test_legacy_field_mapping(self):
        """Test that legacy field names are properly mapped."""
        therapist_data = {
            "id": "123",
            "lookType": ["kawaii"],  # Legacy field name
            "talkLevel": "talkative",  # Legacy field name
            "moodTag": ["cheerful"],  # Legacy field name (should be list)
        }
        guest_prefs = {
            "lookPref": ["kawaii"],  # Legacy field name
            "talkPref": "talkative",  # Legacy field name
            "moodPref": ["cheerful"],  # Legacy field name
        }

        result = score_candidate_legacy(therapist_data, guest_prefs)
        assert "score" in result
        # Should produce a reasonable score, not crash
        assert 0.0 <= result["score"] <= 2.0  # Max possible with blending
