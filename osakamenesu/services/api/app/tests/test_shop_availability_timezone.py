from __future__ import annotations

from datetime import datetime, timedelta

from app.domains.site.services.shop import availability as availability_module
from app.schemas import AvailabilitySlot
from app.utils.datetime import JST, ensure_jst_datetime


def test_convert_slots_normalizes_z_suffix_to_jst():
    slots_json = {
        "slots": [
            {
                "start_at": "2025-03-01T15:00:00Z",
                "end_at": "2025-03-01T16:30:00Z",
                "status": "open",
            }
        ]
    }

    slots = availability_module.convert_slots(slots_json)
    assert len(slots) == 1
    slot = slots[0]
    assert slot.start_at.tzinfo is not None
    assert slot.start_at.tzinfo == JST
    assert slot.end_at.tzinfo == JST
    # 15:00Z should become 24:00 JST (= next day 00:00)
    assert slot.start_at == datetime(2025, 3, 2, 0, 0, tzinfo=JST)
    assert slot.end_at == datetime(2025, 3, 2, 1, 30, tzinfo=JST)


def test_build_next_slot_candidate_outputs_jst_datetime():
    # Final Decision: API status is "open" | "blocked" only (tentative is UI-only)
    slot = AvailabilitySlot(
        start_at=datetime(2025, 1, 5, 10, 0),
        end_at=datetime(2025, 1, 5, 11, 0),
        status="open",
    )
    now_value = ensure_jst_datetime(datetime(2025, 1, 5, 9, 30))

    candidate = availability_module._build_next_slot_candidate(
        slot,
        now_jst_value=now_value,
    )
    assert candidate is not None
    comparable, payload = candidate
    assert comparable.tzinfo == JST
    assert payload.start_at.tzinfo == JST
    assert payload.start_at.isoformat().endswith("+09:00")
    assert payload.status == "ok"


def test_build_next_slot_candidate_rejects_past_slot_with_jst():
    slot = AvailabilitySlot(
        start_at=datetime(2025, 1, 5, 8, 0),
        end_at=datetime(2025, 1, 5, 9, 0),
        status="open",
    )
    now_value = ensure_jst_datetime(datetime(2025, 1, 5, 9, 1))

    candidate = availability_module._build_next_slot_candidate(
        slot,
        now_jst_value=now_value,
    )
    assert candidate is None
