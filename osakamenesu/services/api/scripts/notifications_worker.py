"""Standalone notifications worker entry point."""

from __future__ import annotations

import asyncio
import logging
import signal
from typing import Optional

from app.notifications import run_worker_forever


async def _run(stop_event: asyncio.Event) -> None:
    await run_worker_forever(stop_event)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="[notifications-worker] %(message)s")

    stop_event: Optional[asyncio.Event] = None

    async def runner() -> None:
        nonlocal stop_event
        stop_event = asyncio.Event()
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(sig, stop_event.set)
            except NotImplementedError:
                pass
        await _run(stop_event)

    try:
        asyncio.run(runner())
    except KeyboardInterrupt:
        if stop_event is not None:
            stop_event.set()


if __name__ == "__main__":
    main()
