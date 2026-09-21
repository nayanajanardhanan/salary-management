"""Login endpoint tests (`POST /api/v1/auth/login`).

Uses the `unauthenticated_client` fixture (see `tests/conftest.py`) since
login itself must be reachable without a token — it's how one is obtained.
`app.services.auth_service.hash_password` is used directly to seed an
`HrUser` row per test, independent of `app.scripts.seed` (covered by
`tests/scripts/test_seed.py`).
"""

import logging

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.hr_user import HrUser
from app.services import auth_service

PASSWORD = "correct horse battery staple"


def _hr_user(db_session: Session, **overrides) -> HrUser:
    fields = dict(
        username="hr.admin",
        email="hr.admin@payscope.local",
        password_hash=auth_service.hash_password(PASSWORD),
        is_active=True,
    )
    fields.update(overrides)
    user = HrUser(**fields)
    db_session.add(user)
    db_session.commit()
    return user


# --- Successful login ---------------------------------------------------------


def test_login_with_username_succeeds(
    unauthenticated_client: TestClient, db_session: Session
) -> None:
    _hr_user(db_session)

    response = unauthenticated_client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "hr.admin", "password": PASSWORD},
    )

    assert response.status_code == 200


def test_login_with_email_succeeds(unauthenticated_client: TestClient, db_session: Session) -> None:
    _hr_user(db_session)

    response = unauthenticated_client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "hr.admin@payscope.local", "password": PASSWORD},
    )

    assert response.status_code == 200


def test_login_response_has_the_expected_token_structure(
    unauthenticated_client: TestClient, db_session: Session
) -> None:
    _hr_user(db_session)

    response = unauthenticated_client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "hr.admin", "password": PASSWORD},
    )

    body = response.json()
    assert set(body.keys()) == {"access_token", "token_type", "expires_in"}
    assert isinstance(body["access_token"], str) and body["access_token"]
    assert body["token_type"] == "bearer"
    assert isinstance(body["expires_in"], int) and body["expires_in"] > 0


def test_login_never_returns_the_password_hash(
    unauthenticated_client: TestClient, db_session: Session
) -> None:
    user = _hr_user(db_session)

    response = unauthenticated_client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "hr.admin", "password": PASSWORD},
    )

    assert user.password_hash not in response.text
    assert "password_hash" not in response.text
    assert "password" not in response.json()


# --- Rejected login attempts ---------------------------------------------------


def test_login_with_incorrect_password_returns_401(
    unauthenticated_client: TestClient, db_session: Session
) -> None:
    _hr_user(db_session)

    response = unauthenticated_client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "hr.admin", "password": "wrong-password"},
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_login_with_unknown_username_or_email_returns_401(
    unauthenticated_client: TestClient, db_session: Session
) -> None:
    response = unauthenticated_client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "nobody", "password": "irrelevant"},
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_login_for_an_inactive_user_returns_401(
    unauthenticated_client: TestClient, db_session: Session
) -> None:
    _hr_user(db_session, is_active=False)

    response = unauthenticated_client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "hr.admin", "password": PASSWORD},
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_login_error_message_does_not_reveal_which_field_was_wrong(
    unauthenticated_client: TestClient, db_session: Session
) -> None:
    """Unknown identifier and wrong password must be indistinguishable to the caller."""
    _hr_user(db_session)

    unknown_identifier = unauthenticated_client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "nobody", "password": "irrelevant"},
    )
    wrong_password = unauthenticated_client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "hr.admin", "password": "wrong-password"},
    )

    assert unknown_identifier.status_code == wrong_password.status_code == 401
    assert unknown_identifier.json() == wrong_password.json()


def test_login_missing_password_returns_422(
    unauthenticated_client: TestClient, db_session: Session
) -> None:
    response = unauthenticated_client.post(
        "/api/v1/auth/login", json={"username_or_email": "hr.admin"}
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_login_missing_username_or_email_returns_422(
    unauthenticated_client: TestClient, db_session: Session
) -> None:
    response = unauthenticated_client.post("/api/v1/auth/login", json={"password": PASSWORD})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_login_empty_request_body_returns_422(
    unauthenticated_client: TestClient, db_session: Session
) -> None:
    response = unauthenticated_client.post("/api/v1/auth/login", json={})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_login_blank_password_returns_422(
    unauthenticated_client: TestClient, db_session: Session
) -> None:
    _hr_user(db_session)

    response = unauthenticated_client.post(
        "/api/v1/auth/login", json={"username_or_email": "hr.admin", "password": ""}
    )

    assert response.status_code == 422


# --- The issued token works against protected endpoints ------------------------


def test_login_token_can_access_a_protected_endpoint(
    unauthenticated_client: TestClient, db_session: Session
) -> None:
    _hr_user(db_session)

    login_response = unauthenticated_client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "hr.admin", "password": PASSWORD},
    )
    token = login_response.json()["access_token"]

    response = unauthenticated_client.get(
        "/api/v1/employees", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200


# --- Nothing sensitive is ever logged ------------------------------------------


def test_login_does_not_log_the_password_or_the_issued_token(
    unauthenticated_client: TestClient,
    db_session: Session,
    caplog: pytest.LogCaptureFixture,
) -> None:
    _hr_user(db_session)

    with caplog.at_level(logging.DEBUG):
        response = unauthenticated_client.post(
            "/api/v1/auth/login",
            json={"username_or_email": "hr.admin", "password": PASSWORD},
        )

    access_token = response.json()["access_token"]
    log_text = "\n".join(record.getMessage() for record in caplog.records)

    assert PASSWORD not in log_text
    assert access_token not in log_text


def test_failed_login_does_not_log_the_attempted_password(
    unauthenticated_client: TestClient, db_session: Session, caplog: pytest.LogCaptureFixture
) -> None:
    _hr_user(db_session)

    with caplog.at_level(logging.DEBUG):
        unauthenticated_client.post(
            "/api/v1/auth/login",
            json={"username_or_email": "hr.admin", "password": "a-very-unique-wrong-password"},
        )

    log_text = "\n".join(record.getMessage() for record in caplog.records)
    assert "a-very-unique-wrong-password" not in log_text
