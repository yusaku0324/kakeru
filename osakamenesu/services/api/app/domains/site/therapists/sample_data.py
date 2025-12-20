"""Sample therapist data for demo/development."""

from .schemas import (
    TherapistTags,
    TherapistInfo,
    ShopInfo,
    AvailabilityInfo,
    AvailabilityWindow,
    BreakdownInfo,
    TherapistDetailResponse,
    SimilarTherapistTags,
    SimilarTherapistItem,
)
from .scoring import compute_price_rank


# Sample therapist data for demo/development
SAMPLE_THERAPISTS: dict[str, dict] = {
    "11111111-1111-1111-8888-111111111111": {
        "name": "葵",
        "age": 26,
        "price_min": 11000,
        "price_max": 15000,
        "profile_text": "丁寧なオイルトリートメントで人気のセラピストです。お客様一人ひとりに合わせた施術を心がけています。",
        "photos": ["/images/demo-therapist-1.svg"],
        "specialties": ["リンパ", "ホットストーン", "指名多数"],
        "shop_slug": "sample-namba-resort",
        "shop_name": "アロマリゾート 難波本店",
        "shop_area": "難波/日本橋",
    },
    "22222222-2222-2222-8888-222222222222": {
        "name": "凛",
        "age": 24,
        "price_min": 10000,
        "price_max": 14000,
        "profile_text": "ストレッチと指圧を組み合わせた独自施術が評判です。疲れた身体を芯からほぐします。",
        "photos": ["/images/demo-therapist-2.svg"],
        "specialties": ["ストレッチ", "指圧", "ディープリンパ"],
        "shop_slug": "sample-namba-resort",
        "shop_name": "アロマリゾート 難波本店",
        "shop_area": "難波/日本橋",
    },
}


def get_sample_therapist_response(
    therapist_id: str,
    shop_slug: str | None,
    entry_source: str,
    days: int,
    slot_granularity_minutes: int,
) -> TherapistDetailResponse | None:
    """Return sample therapist data if ID matches known samples."""
    sample = SAMPLE_THERAPISTS.get(therapist_id)
    if not sample:
        return None

    # Verify shop_slug if provided
    if shop_slug and sample["shop_slug"] != shop_slug:
        return None

    tags = TherapistTags(
        mood="癒し系",
        style="ソフト",
        look=None,
        contact=None,
        hobby_tags=sample.get("specialties"),
    )

    therapist_info = TherapistInfo(
        id=therapist_id,
        name=sample["name"],
        age=sample.get("age"),
        price_rank=compute_price_rank(sample.get("price_min"), sample.get("price_max")),
        tags=tags,
        profile_text=sample.get("profile_text"),
        photos=sample.get("photos"),
        badges=["人気"],
    )

    shop_info = ShopInfo(
        id="sample-shop-id",
        slug=sample["shop_slug"],
        name=sample["shop_name"],
        area=sample["shop_area"],
    )

    # Empty availability for sample
    availability = AvailabilityInfo(
        slots=[],
        phase="explore",
        window=AvailabilityWindow(
            days=days,
            slot_granularity_minutes=slot_granularity_minutes,
        ),
    )

    # Simple sample scores
    breakdown = BreakdownInfo(
        base_staff_similarity=0.8,
        tag_similarity=0.7,
        price_match=0.6,
        age_match=0.75,
        availability_boost=0.0,
        score=0.72,
    )

    return TherapistDetailResponse(
        therapist=therapist_info,
        shop=shop_info,
        availability=availability,
        recommended_score=0.72,
        breakdown=breakdown,
        entry_source=entry_source,
    )


def get_sample_similar_therapists(
    therapist_id_str: str, limit: int
) -> list[SimilarTherapistItem] | None:
    """Return sample similar therapists if ID matches known samples."""
    if therapist_id_str not in SAMPLE_THERAPISTS:
        return None

    similar_items: list[SimilarTherapistItem] = []
    for other_id, other_data in SAMPLE_THERAPISTS.items():
        if other_id != therapist_id_str:
            similar_items.append(
                SimilarTherapistItem(
                    id=other_id,
                    name=other_data["name"],
                    photos=other_data.get("photos"),
                    tags=SimilarTherapistTags(
                        mood="癒し系",
                        style="ソフト",
                    ),
                    price_rank=compute_price_rank(
                        other_data.get("price_min"),
                        other_data.get("price_max"),
                    ),
                    similarity_score=0.85,
                    available_today=True,
                )
            )
    return similar_items[:limit]
