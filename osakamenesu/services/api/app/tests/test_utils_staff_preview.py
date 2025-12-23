import uuid

from app.utils import staff_preview


class DummyTherapist:
    def __init__(
        self,
        *,
        id: uuid.UUID,
        name: str,
        status: str = "published",
        alias: str | None = None,
        headline: str | None = None,
        specialties: list[str] | None = None,
        photo_urls: list[str] | None = None,
    ) -> None:
        self.id = id
        self.name = name
        self.status = status
        self.alias = alias
        self.headline = headline
        self.specialties = specialties or []
        self.photo_urls = photo_urls or []


class DummyProfile:
    def __init__(self, therapists: list[DummyTherapist]) -> None:
        self.therapists = therapists


def test_normalize_text_trims_and_casts():
    assert staff_preview._normalize_text("  hello  ") == "hello"
    assert staff_preview._normalize_text("   ") is None
    assert staff_preview._normalize_text(None) is None
    assert staff_preview._normalize_text(123) == "123"


def test_collect_staff_specialties_filters_invalid_entries():
    raw = ["  oil ", "", None, "stretch"]
    assert staff_preview._collect_staff_specialties(raw) == ["oil", "stretch"]


def test_normalize_name_for_matching():
    # Basic normalization
    assert staff_preview._normalize_name_for_matching("Alice") == "alice"
    # Remove whitespace
    assert staff_preview._normalize_name_for_matching("山田 太郎") == "山田太郎"
    assert staff_preview._normalize_name_for_matching("  Alice  ") == "alice"
    # Full-width to half-width (NFKC)
    assert staff_preview._normalize_name_for_matching("Ａｌｉｃｅ") == "alice"
    # Empty/None handling
    assert staff_preview._normalize_name_for_matching("") == ""
    assert staff_preview._normalize_name_for_matching(None) == ""


def test_build_staff_preview_matches_existing_therapists():
    therapist_one = DummyTherapist(
        id=uuid.uuid4(),
        name="Alice",
        alias="A",
        headline="Relax master",
        specialties=["oil", "stretch"],
        photo_urls=["https://example.com/alice.jpg"],
    )
    therapist_two = DummyTherapist(
        id=uuid.uuid4(),
        name="Bea",
        specialties=["reflexology"],
    )
    therapist_three = DummyTherapist(
        id=uuid.uuid4(),
        name="Chloe",
    )
    profile = DummyProfile([therapist_one, therapist_two, therapist_three])

    preview = staff_preview._build_staff_preview(
        profile,
        {
            "staff": [
                {
                    "id": str(therapist_one.id),
                    "name": "Alice",
                    "rating": "4.6",
                    "review_count": "12",
                    "specialties": [" lymph ", "", None],
                },
                {
                    "name": "Bea",
                    "photo_url": "https://example.com/bea.jpg",
                    "specialties": ["Thai"],
                },
            ]
        },
    )

    assert preview[0]["id"] == str(therapist_one.id)
    assert preview[0]["specialties"] == ["lymph"]
    assert preview[1]["id"] == str(therapist_two.id)
    assert preview[1]["avatar_url"] == "https://example.com/bea.jpg"
    assert any(entry["id"] == str(therapist_three.id) for entry in preview)


def test_build_staff_preview_matches_with_whitespace_differences():
    """Test that names with whitespace differences still match."""
    therapist = DummyTherapist(
        id=uuid.uuid4(),
        name="山田太郎",  # No space
    )
    profile = DummyProfile([therapist])

    preview = staff_preview._build_staff_preview(
        profile,
        {
            "staff": [
                {
                    "name": "山田 太郎",  # With space
                },
            ]
        },
    )

    # Should match despite whitespace difference
    assert preview[0]["id"] == str(therapist.id)
