"""Minimal, container-friendly application logging configuration.

Configures the root logger once, at application startup, so every logger in
the process (e.g. `app.core.errors`'s `logging.getLogger("app")`, and
libraries such as `uvicorn`) shares a consistent timestamp/level/format and
writes to stdout — the convention container runtimes (Docker, Docker
Compose, Kubernetes) expect, so `docker compose logs` / `docker logs` show
application logs without extra configuration.

This intentionally does not add a logging framework, structured/JSON
output, file handlers, or log shipping/aggregation — see
`docs/architecture.md` Section 4.7 and Section 7 of the deployment
documentation for what is and is not implemented. What gets logged (and, at
the error-handling layer, what is deliberately *not* logged — e.g. request
bodies or error `details`, which could contain caller-supplied input) is
unchanged by this module; it only configures *how* log records are
formatted and where they go.
"""

import logging
import sys

_LOG_FORMAT = "%(asctime)s %(levelname)-8s %(name)s: %(message)s"


def configure_logging(level: str) -> None:
    """Configure the root logger's level, format, and destination (stdout).

    Idempotent: safe to call more than once in the same process (e.g. under
    tests, which construct the FastAPI app repeatedly) — a second call only
    updates the level, without attaching duplicate handlers that would
    otherwise print every log line multiple times.
    """
    root = logging.getLogger()
    if not root.handlers:
        handler = logging.StreamHandler(stream=sys.stdout)
        handler.setFormatter(logging.Formatter(_LOG_FORMAT))
        root.addHandler(handler)
    root.setLevel(level.upper())
