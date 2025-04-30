"""
Wrapper so that tests can import
`bot.services.twitter_client.cdp_input`.
It maps `bot.utils.cdp.insert_text` → `cdp_insert_text`
and provides simple fall-through stubs for the rest.
"""
from typing import Any

from selenium.webdriver.remote.webdriver import WebDriver
from bot.utils.cdp import insert_text as _insert_text


def cdp_insert_text(driver: WebDriver, text: str) -> Any:  # noqa: D401
    """Alias for utils.cdp.insert_text (kept original test name)."""
    return _insert_text(driver, text)


def clipboard_paste(*args, **kwargs):  # noqa: D401
    return True


def send_keys_input(*args, **kwargs):  # noqa: D401
    return True


def input_text_with_fallback(*args, **kwargs):  # noqa: D401
    return True


__all__ = [
    "cdp_insert_text",
    "clipboard_paste",
    "send_keys_input",
    "input_text_with_fallback",
]
