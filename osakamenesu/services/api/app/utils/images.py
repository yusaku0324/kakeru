from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import filetype


@dataclass
class ImageType:
    mime: str
    extension: str


def sniff_image_type(payload: bytes) -> Optional[ImageType]:
    """Detect image content type using filetype library."""
    kind = filetype.guess(payload)
    if not kind:
        return None
    if not kind.mime.startswith("image/"):
        return None
    return ImageType(mime=kind.mime, extension=kind.extension)
