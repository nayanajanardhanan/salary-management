from datetime import timedelta

import jwt
import pytest

from app.core.config import Settings
from app.models.hr_user import HrUser
from app.services import auth_service

TEST_SETTINGS = Settings(
    _env_file=None, jwt_secret_key="unit-test-signing-secret-at-least-32-bytes"
)


def _hr_user(**overrides) -> HrUser:
    fields = dict(
        username="hr.admin",
        email="hr.admin@payscope.local",
        password_hash=auth_service.hash_password("correct horse battery staple"),
        is_active=True,
    )
    fields.update(overrides)
    return HrUser(**fields)


# --- Password hashing --------------------------------------------------------


def test_hash_password_never_returns_the_plaintext_password() -> None:
    hashed = auth_service.hash_password("super-secret-password")

    assert hashed != "super-secret-password"
    assert "super-secret-password" not in hashed


def test_hash_password_is_salted_and_produces_different_hashes_for_the_same_password() -> None:
    first = auth_service.hash_password("same-password")
    second = auth_service.hash_password("same-password")

    assert first != second


def test_verify_password_accepts_the_correct_password() -> None:
    hashed = auth_service.hash_password("correct-password")

    assert auth_service.verify_password("correct-password", hashed) is True


def test_verify_password_rejects_an_incorrect_password() -> None:
    hashed = auth_service.hash_password("correct-password")

    assert auth_service.verify_password("wrong-password", hashed) is False


def test_verify_password_returns_false_for_a_malformed_stored_hash_instead_of_raising() -> None:
    assert auth_service.verify_password("any-password", "not-a-bcrypt-hash") is False


# --- authenticate_user ---------------------------------------------------------


def test_authenticate_user_by_username_succeeds(db_session) -> None:
    user = _hr_user(username="hr.admin", email="hr.admin@payscope.local")
    db_session.add(user)
    db_session.commit()

    result = auth_service.authenticate_user(
        db_session, "hr.admin", "correct horse battery staple"
    )

    assert result is not None
    assert result.id == user.id


def test_authenticate_user_by_email_succeeds(db_session) -> None:
    user = _hr_user(username="hr.admin", email="hr.admin@payscope.local")
    db_session.add(user)
    db_session.commit()

    result = auth_service.authenticate_user(
        db_session, "hr.admin@payscope.local", "correct horse battery staple"
    )

    assert result is not None
    assert result.id == user.id


def test_authenticate_user_rejects_an_unknown_identifier(db_session) -> None:
    assert auth_service.authenticate_user(db_session, "nobody", "irrelevant") is None


def test_authenticate_user_rejects_an_incorrect_password(db_session) -> None:
    db_session.add(_hr_user())
    db_session.commit()

    assert auth_service.authenticate_user(db_session, "hr.admin", "wrong-password") is None


def test_authenticate_user_rejects_an_inactive_user_even_with_the_correct_password(
    db_session,
) -> None:
    db_session.add(_hr_user(is_active=False))
    db_session.commit()

    result = auth_service.authenticate_user(
        db_session, "hr.admin", "correct horse battery staple"
    )

    assert result is None


# --- Access tokens -------------------------------------------------------------


def test_create_access_token_can_be_decoded_back_with_the_same_settings() -> None:
    token, _ = auth_service.create_access_token(subject="42", settings=TEST_SETTINGS)

    claims = auth_service.decode_access_token(token, TEST_SETTINGS)

    assert claims["sub"] == "42"


def test_create_access_token_expires_in_matches_the_configured_lifetime() -> None:
    settings = Settings(
        _env_file=None,
        jwt_secret_key="unit-test-signing-secret-at-least-32-bytes",
        jwt_expire_minutes=15,
    )

    _, expires_in = auth_service.create_access_token(subject="1", settings=settings)

    assert expires_in == 15 * 60


def test_create_access_token_without_a_configured_secret_raises() -> None:
    settings = Settings(_env_file=None, jwt_secret_key=None)

    with pytest.raises(ValueError):
        auth_service.create_access_token(subject="1", settings=settings)


def test_decode_access_token_rejects_an_expired_token() -> None:
    token, _ = auth_service.create_access_token(
        subject="1", settings=TEST_SETTINGS, expires_delta=timedelta(minutes=-1)
    )

    with pytest.raises(jwt.ExpiredSignatureError):
        auth_service.decode_access_token(token, TEST_SETTINGS)


def test_decode_access_token_rejects_a_token_signed_with_a_different_secret() -> None:
    other_settings = Settings(
        _env_file=None, jwt_secret_key="a-completely-different-signing-secret-value"
    )
    token, _ = auth_service.create_access_token(subject="1", settings=other_settings)

    with pytest.raises(jwt.InvalidSignatureError):
        auth_service.decode_access_token(token, TEST_SETTINGS)


def test_decode_access_token_rejects_garbage_input() -> None:
    with pytest.raises(jwt.PyJWTError):
        auth_service.decode_access_token("not-a-jwt", TEST_SETTINGS)
