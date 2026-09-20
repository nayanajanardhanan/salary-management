from app.core.currencies import SUPPORTED_CURRENCY_CODES


def test_supported_currency_codes_includes_common_currencies() -> None:
    for code in ("USD", "GBP", "EUR", "INR", "JPY", "CAD", "AUD", "SGD"):
        assert code in SUPPORTED_CURRENCY_CODES


def test_supported_currency_codes_includes_every_data_generator_currency() -> None:
    """Every currency the synthetic data generator can produce must be
    accepted, or seeded/generated data could fail this validation."""
    from app.data_generation.constants import COUNTRY_SALARY_PROFILES

    for profile in COUNTRY_SALARY_PROFILES:
        assert profile.currency in SUPPORTED_CURRENCY_CODES


def test_supported_currency_codes_excludes_precious_metals() -> None:
    for code in ("XAU", "XAG", "XPD", "XPT"):
        assert code not in SUPPORTED_CURRENCY_CODES


def test_supported_currency_codes_excludes_reserved_codes() -> None:
    for code in ("XXX", "XTS"):
        assert code not in SUPPORTED_CURRENCY_CODES


def test_supported_currency_codes_excludes_bond_and_accounting_units() -> None:
    for code in ("XDR", "XSU", "XUA", "USN", "CLF", "XBA", "XBB", "XBC", "XBD"):
        assert code not in SUPPORTED_CURRENCY_CODES


def test_supported_currency_codes_excludes_unrecognized_codes() -> None:
    for code in ("ZZZ", "QQQ", "XYZ", "ABC"):
        assert code not in SUPPORTED_CURRENCY_CODES


def test_supported_currency_codes_are_all_three_letter_uppercase() -> None:
    for code in SUPPORTED_CURRENCY_CODES:
        assert len(code) == 3
        assert code.isalpha()
        assert code == code.upper()


def test_supported_currency_codes_is_a_frozenset() -> None:
    assert isinstance(SUPPORTED_CURRENCY_CODES, frozenset)
    assert len(SUPPORTED_CURRENCY_CODES) > 100
