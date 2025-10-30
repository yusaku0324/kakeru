from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
os.chdir(ROOT)
sys.path.insert(0, str(ROOT / "services" / "api"))

from app.utils import slug, text


def test_slugify_normalizes_and_trims():
    assert slug.slugify("  Hello, World!  ") == "hello-world"
    assert slug.slugify("Café Déjà Vu") == "café-déjà-vu"
    assert slug.slugify("   ") == ""


def test_strip_or_none():
    assert text.strip_or_none("  value  ") == "value"
    assert text.strip_or_none("   ") is None
    assert text.strip_or_none(None) is None


def test_sanitize_strings_and_photo_urls():
    raw = [" first ", "", " second", 3, None, "third "]
    expected = ["first", "second", "third"]
    assert text.sanitize_strings(raw) == expected
    assert text.sanitize_photo_urls(raw) == expected
    assert text.sanitize_strings(None) == []
