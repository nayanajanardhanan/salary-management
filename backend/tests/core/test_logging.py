import logging

from app.core.logging import configure_logging


def test_configure_logging_sets_root_level(monkeypatch) -> None:
    root = logging.getLogger()
    monkeypatch.setattr(root, "handlers", [])

    configure_logging("DEBUG")

    assert root.level == logging.DEBUG


def test_configure_logging_accepts_lowercase_level(monkeypatch) -> None:
    root = logging.getLogger()
    monkeypatch.setattr(root, "handlers", [])

    configure_logging("warning")

    assert root.level == logging.WARNING


def test_configure_logging_does_not_duplicate_handlers_when_called_twice(monkeypatch) -> None:
    root = logging.getLogger()
    monkeypatch.setattr(root, "handlers", [])

    configure_logging("INFO")
    handlers_after_first_call = len(root.handlers)
    configure_logging("INFO")

    assert len(root.handlers) == handlers_after_first_call
