from typing import Any
import logging
from threading import Lock

from meilisearch import Client
from meilisearch.errors import MeilisearchApiError
from .settings import settings

INDEX = "profiles"

logger = logging.getLogger("app.meili")

_index_init_lock = Lock()
_indexes_ensured = False


def get_client() -> Client:
    return Client(settings.meili_host, settings.meili_master_key)


def _extract_task_uid(task: Any) -> Any:
    if task is None:
        return None
    if isinstance(task, dict):
        return task.get("taskUid") or task.get("uid")
    return getattr(task, "task_uid", None) or getattr(task, "uid", None)


def _wait_for_task(task: Any, client: Client | None = None) -> None:
    uid = _extract_task_uid(task)
    if uid is None:
        return
    (client or get_client()).wait_for_task(uid)


def ensure_indexes() -> None:
    global _indexes_ensured
    client = get_client()
    try:
        client.get_index(INDEX)
    except Exception:
        create_task = client.create_index(INDEX, {"primaryKey": "id"})
        _wait_for_task(create_task, client)
    idx = client.index(INDEX)
    # Use default ranking rules and avoid invalid custom rules for Meilisearch v1.x
    # Custom ordering can be achieved via the `sort` parameter at query time.
    settings_task = idx.update_settings(
        {
            "filterableAttributes": [
                "area",
                "bust_tag",
                "service_type",
                "body_tags",
                "price_min",
                "price_max",
                "price_band",
                "status",
                "today",
                "height_cm",
                "age",
                "ranking_badges",
                "has_promotions",
                "has_discounts",
                "has_diaries",
                "nearest_station",
                "station_line",
                "station_walk_minutes",
            ],
            "sortableAttributes": [
                "price_min",
                "price_max",
                "updated_at",
                "ctr7d",
                "today",
                "height_cm",
                "age",
                "ranking_weight",
                "ranking_score",
                "review_score",
                "review_count",
            ],
            "searchableAttributes": [
                "name",
                "store_name",
                "area",
                "nearest_station",
                "station_line",
                "body_tags",
                "ranking_badges",
            ],
            # Keep default ranking rules; use `sort` at query time for ordering
            "rankingRules": ["words", "typo", "proximity", "attribute", "sort", "exactness"],
        }
    )
    _wait_for_task(settings_task, client)
    _indexes_ensured = True


def ensure_indexes_if_needed() -> None:
    global _indexes_ensured
    if _indexes_ensured:
        return
    with _index_init_lock:
        if _indexes_ensured:
            return
        try:
            ensure_indexes()
        except Exception:
            _indexes_ensured = False
            raise


def index_profile(doc: dict):
    ensure_indexes_if_needed()
    client = get_client()
    task = client.index(INDEX).add_documents([doc])
    _wait_for_task(task, client)


def index_bulk(docs: list[dict]):
    if not docs:
        return
    ensure_indexes_if_needed()
    client = get_client()
    task = client.index(INDEX).add_documents(docs)
    _wait_for_task(task, client)


def delete_profile(doc_id: str):
    ensure_indexes_if_needed()
    client = get_client()
    task = client.index(INDEX).delete_document(doc_id)
    _wait_for_task(task, client)


def purge_all():
    """Delete all documents in the index (keeps settings)."""
    ensure_indexes_if_needed()
    client = get_client()
    task = client.index(INDEX).delete_all_documents()
    _wait_for_task(task, client)


def build_filter(
    area: str | None,
    station: str | None,
    bust: str | None,
    service_type: str | None,
    body_tags: list[str] | None,
    today: bool | None,
    price_min: int | None,
    price_max: int | None,
    status: str | None,
    *,
    price_bands: list[str] | None = None,
    ranking_badges: list[str] | None = None,
    has_promotions: bool | None = None,
    has_discounts: bool | None = None,
    has_diaries: bool | None = None,
) -> str | None:
    parts: list[str] = []
    if area:
        parts.append(f"area = '{area}'")
    if station:
        parts.append(f"nearest_station = '{station}'")
    if bust:
        parts.append(f"bust_tag = '{bust}'")
    if service_type:
        parts.append(f"service_type = '{service_type}'")
    if body_tags:
        for t in body_tags:
            parts.append(f"body_tags = '{t}'")
    if today is not None:
        parts.append(f"today = {'true' if today else 'false'}")
    if status:
        parts.append(f"status = '{status}'")
    if price_bands:
        or_clause = " OR ".join(f"price_band = '{band}'" for band in price_bands)
        if or_clause:
            parts.append(f"({or_clause})")
    if ranking_badges:
        or_clause = " OR ".join(f"ranking_badges = '{badge}'" for badge in ranking_badges)
        if or_clause:
            parts.append(f"({or_clause})")
    if has_promotions is not None:
        parts.append(f"has_promotions = {'true' if has_promotions else 'false'}")
    if has_discounts is not None:
        parts.append(f"has_discounts = {'true' if has_discounts else 'false'}")
    if has_diaries is not None:
        parts.append(f"has_diaries = {'true' if has_diaries else 'false'}")
    rng: list[str] = []
    if price_min is not None:
        rng.append(f"price_min >= {price_min}")
    if price_max is not None:
        rng.append(f"price_max <= {price_max}")
    if rng:
        parts.extend(rng)
    if not parts:
        return None
    return " AND ".join(parts)


def search(
    q: str | None,
    filter_expr: str | None,
    sort: list[str] | str | None,
    page: int,
    page_size: int,
    facets: list[str] | None = None,
) -> dict:
    ensure_indexes_if_needed()
    idx = get_client().index(INDEX)
    options: dict = {"limit": page_size, "offset": (page - 1) * page_size}
    if filter_expr:
        options["filter"] = filter_expr
    if sort:
        if isinstance(sort, list):
            options["sort"] = sort
        else:
            options["sort"] = [sort]
    if facets:
        options["facets"] = facets
    # meilisearch-python >=0.30 expects the query as the first positional arg
    try:
        return idx.search(q or "", options)
    except MeilisearchApiError as exc:
        message = str(exc).lower()
        if exc.error_code == "invalid_search_filter" or "not filterable" in message:
            logger.warning("meilisearch invalid filter detected; reapplying index settings and retrying")
            try:
                with _index_init_lock:
                    ensure_indexes()
            except Exception as ensure_exc:  # pragma: no cover - defensive logging
                logger.error("failed to reapply meilisearch settings: %s", ensure_exc)
            idx = get_client().index(INDEX)
            try:
                return idx.search(q or "", options)
            except MeilisearchApiError as retry_exc:
                logger.error("meilisearch retry failed after settings reapplied: %s", retry_exc)
                raise
        raise
