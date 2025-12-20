from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone, date
from uuid import uuid4

from app.domains.admin import shop_dashboard_api as api
from app.models import GuestReservation, TherapistShift


def _dt(hour: int) -> datetime:
    return datetime(2025, 1, 1, hour, 0, tzinfo=timezone.utc)


class DummySession:
    def __init__(self, reservations=None, shifts=None, therapists=None):
        self.reservations = reservations or []
        self.shifts = shifts or []
        self.therapists = therapists or []

    def _extract_date_bounds(self, stmt):
        """Extract date range bounds from WHERE clause."""
        bounds = {"start_gte": None, "start_lt": None, "date_eq": None}
        whereclause = getattr(stmt, "whereclause", None)
        if whereclause is None:
            return bounds

        # Recursively find BinaryExpression nodes with date comparisons
        def extract_from_clause(clause):
            if hasattr(clause, "clauses"):
                for sub in clause.clauses:
                    extract_from_clause(sub)
            elif hasattr(clause, "left") and hasattr(clause, "right"):
                left_str = str(clause.left)
                right = clause.right
                op = (
                    str(clause.operator.__name__) if hasattr(clause, "operator") else ""
                )
                # Get bound value
                val = None
                if hasattr(right, "value"):
                    val = right.value
                elif hasattr(right, "effective_value"):
                    val = right.effective_value

                if "start_at" in left_str:
                    if op in ("ge", "gte"):
                        bounds["start_gte"] = val
                    elif op in ("lt",):
                        bounds["start_lt"] = val
                if "date" in left_str.lower() and op == "eq":
                    bounds["date_eq"] = val

        extract_from_clause(whereclause)
        return bounds

    def _filter_reservations(self, items, bounds):
        """Filter reservations by date bounds."""
        result = []
        for r in items:
            if bounds["start_gte"] and r.start_at < bounds["start_gte"]:
                continue
            if bounds["start_lt"] and r.start_at >= bounds["start_lt"]:
                continue
            result.append(r)
        return result

    def _filter_shifts(self, items, bounds):
        """Filter shifts by date."""
        if bounds["date_eq"] is None:
            return items
        return [s for s in items if s.date == bounds["date_eq"]]

    async def execute(self, stmt):
        # Check if this is a count query (func.count)
        is_count_query = False
        selected_columns = getattr(stmt, "selected_columns", None) or getattr(
            stmt, "columns", []
        )
        for col in selected_columns:
            col_str = str(col)
            if "count" in col_str.lower():
                is_count_query = True
                break

        # Determine which model/table is being queried
        items = []
        stmt_str = str(stmt).lower()
        bounds = self._extract_date_bounds(stmt)

        if "guest_reservations" in stmt_str:
            items = self._filter_reservations(self.reservations, bounds)
        elif "therapist_shifts" in stmt_str:
            items = self._filter_shifts(self.shifts, bounds)
        elif "therapists" in stmt_str:
            items = self.therapists
        else:
            # Fallback to naive type inspection
            try:
                model = stmt.column_descriptions[0]["entity"]
                if model is GuestReservation:
                    items = self._filter_reservations(self.reservations, bounds)
                elif model is TherapistShift:
                    items = self._filter_shifts(self.shifts, bounds)
                else:
                    items = self.therapists
            except (AttributeError, IndexError, KeyError):
                items = []

        class R:
            def __init__(self, items, is_count):
                self.items = items
                self.is_count = is_count

            def scalar(self):
                # For count queries, return the count
                return len(self.items) if self.is_count else None

            def scalars(self):
                class S:
                    def __init__(self, items):
                        self._items = items

                    def all(self):
                        return self._items

                return S(self.items)

        return R(items, is_count_query)


def test_dashboard_counts_today_and_week():
    shop_id = uuid4()
    today = _dt(12)
    yesterday = today - timedelta(days=1)
    past_week = today - timedelta(days=8)

    res_today = GuestReservation(
        id=uuid4(),
        shop_id=shop_id,
        therapist_id=uuid4(),
        start_at=today,
        end_at=today + timedelta(hours=1),
        status="confirmed",
    )
    res_week = GuestReservation(
        id=uuid4(),
        shop_id=shop_id,
        therapist_id=uuid4(),
        start_at=yesterday,
        end_at=yesterday + timedelta(hours=1),
        status="confirmed",
    )
    res_old = GuestReservation(
        id=uuid4(),
        shop_id=shop_id,
        therapist_id=uuid4(),
        start_at=past_week,
        end_at=past_week + timedelta(hours=1),
        status="confirmed",
    )
    shift = TherapistShift(
        id=uuid4(),
        therapist_id=uuid4(),
        shop_id=shop_id,
        date=date(2025, 1, 1),
        start_at=_dt(9),
        end_at=_dt(18),
        break_slots=[],
        availability_status="available",
        notes=None,
    )
    session = DummySession(reservations=[res_today, res_week, res_old], shifts=[shift])
    body = asyncio.get_event_loop().run_until_complete(
        api._compute_dashboard(session, shop_id, _dt(0))
    )
    assert body["today_reservations"] == 1
    assert body["week_reservations"] == 2
    assert body["today_shifts"] == 1
    assert "recent_reservations" in body
