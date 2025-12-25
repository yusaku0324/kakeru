"""Example data for API documentation."""

# Shop examples
SHOP_EXAMPLE = {
    "id": "shop123",
    "name": "リラクゼーションサロン大阪",
    "slug": "relaxation-osaka",
    "area": "梅田",
    "station": "大阪駅",
    "category": "リラクゼーション",
    "description": "心と体を癒す極上のリラクゼーションサロンです。",
    "address": "大阪府大阪市北区梅田1-1-1",
    "phone": "06-1234-5678",
    "business_hours": {
        "mon": "10:00-22:00",
        "tue": "10:00-22:00",
        "wed": "10:00-22:00",
        "thu": "10:00-22:00",
        "fri": "10:00-24:00",
        "sat": "10:00-24:00",
        "sun": "10:00-22:00",
    },
    "price_range": {"min": 8000, "max": 20000},
    "is_active": True,
    "rating": 4.5,
    "review_count": 125,
    "photo_url": "https://example.com/shop/shop123/photo.jpg",
}

# Therapist examples
THERAPIST_EXAMPLE = {
    "id": "therapist456",
    "shop_id": "shop123",
    "name": "佐藤 花子",
    "age": 25,
    "height": 165,
    "bust": "C",
    "profile": "お客様に最高の癒しをご提供します。",
    "specialties": ["アロマ", "リンパ", "ヘッドスパ"],
    "is_active": True,
    "rating": 4.8,
    "review_count": 45,
    "photo_url": "https://example.com/therapist/therapist456/photo.jpg",
    "thumbnail_url": "https://example.com/therapist/therapist456/thumb.jpg",
}

# Reservation examples
RESERVATION_EXAMPLE = {
    "id": "res789",
    "reservation_number": "R20240315-001",
    "therapist_id": "therapist456",
    "shop_id": "shop123",
    "guest_name": "山田 太郎",
    "guest_email": "yamada@example.com",
    "guest_phone": "090-1234-5678",
    "start_at": "2024-03-15T14:00:00+09:00",
    "end_at": "2024-03-15T16:00:00+09:00",
    "duration_minutes": 120,
    "course_name": "アロマリラクゼーション120分",
    "price": 18000,
    "status": "confirmed",
    "created_at": "2024-03-14T10:30:00+09:00",
    "confirmed_at": "2024-03-14T10:35:00+09:00",
}

# Error response examples
ERROR_EXAMPLES = {
    "400": {
        "summary": "Bad Request",
        "value": {"detail": "Invalid request parameters", "code": "INVALID_REQUEST"},
    },
    "401": {
        "summary": "Unauthorized",
        "value": {"detail": "Not authenticated", "code": "UNAUTHORIZED"},
    },
    "403": {
        "summary": "Forbidden",
        "value": {"detail": "Permission denied", "code": "FORBIDDEN"},
    },
    "404": {
        "summary": "Not Found",
        "value": {"detail": "Resource not found", "code": "NOT_FOUND"},
    },
    "409": {
        "summary": "Conflict",
        "value": {"detail": "The time slot is already booked", "code": "SLOT_CONFLICT"},
    },
    "422": {
        "summary": "Validation Error",
        "value": {
            "detail": [
                {
                    "loc": ["body", "email"],
                    "msg": "invalid email format",
                    "type": "value_error.email",
                }
            ]
        },
    },
    "429": {
        "summary": "Too Many Requests",
        "value": {"detail": "Rate limit exceeded", "code": "RATE_LIMIT_EXCEEDED"},
    },
    "500": {
        "summary": "Internal Server Error",
        "value": {"detail": "Internal server error", "code": "INTERNAL_ERROR"},
    },
}

# Search request/response examples
SHOP_SEARCH_REQUEST_EXAMPLE = {
    "area": "梅田",
    "price_min": 10000,
    "price_max": 20000,
    "service_tags": "アロマ,リンパ",
    "available_date": "2024-03-15",
    "open_now": True,
    "sort": "rating",
    "page": 1,
    "page_size": 20,
}

SHOP_SEARCH_RESPONSE_EXAMPLE = {
    "items": [SHOP_EXAMPLE],
    "total": 42,
    "page": 1,
    "page_size": 20,
    "has_next": True,
    "has_prev": False,
    "facets": {
        "areas": [
            {"value": "梅田", "count": 15, "label": "梅田"},
            {"value": "難波", "count": 12, "label": "難波"},
            {"value": "心斎橋", "count": 10, "label": "心斎橋"},
        ],
        "price_bands": [
            {"value": "budget", "count": 8, "label": "お手頃"},
            {"value": "standard", "count": 25, "label": "スタンダード"},
            {"value": "premium", "count": 9, "label": "プレミアム"},
        ],
    },
}

# Availability examples
AVAILABILITY_SLOTS_EXAMPLE = {
    "date": "2024-03-15",
    "therapist_id": "therapist456",
    "slots": [
        {
            "start_time": "10:00",
            "end_time": "12:00",
            "is_available": True,
            "duration_options": [60, 90, 120],
        },
        {
            "start_time": "14:00",
            "end_time": "16:00",
            "is_available": True,
            "duration_options": [60, 90, 120],
        },
        {
            "start_time": "18:00",
            "end_time": "20:00",
            "is_available": False,
            "reason": "already_booked",
        },
    ],
}

# Authentication examples
AUTH_REQUEST_EXAMPLE = {"email": "user@example.com"}

AUTH_RESPONSE_EXAMPLE = {
    "message": "認証リンクをメールで送信しました",
    "email": "user@example.com",
}

TOKEN_RESPONSE_EXAMPLE = {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "user": {
        "id": "user123",
        "email": "user@example.com",
        "name": "山田 太郎",
        "is_active": True,
    },
}
