from decimal import Decimal

import pytest

from app.schemas.salary import SalaryRead
from app.services.salary_calculation_service import (
    MixedCurrencyError,
    average_salary,
    ensure_single_currency,
    max_salary,
    min_salary,
    total_salary,
)


def _salary(employee_id: int, amount: str, currency: str = "USD") -> SalaryRead:
    return SalaryRead(employee_id=employee_id, amount=Decimal(amount), currency=currency)


def test_ensure_single_currency_returns_the_shared_currency() -> None:
    salaries = [_salary(1, "1000", "USD"), _salary(2, "2000", "USD")]

    assert ensure_single_currency(salaries) == "USD"


def test_ensure_single_currency_rejects_empty_input() -> None:
    with pytest.raises(ValueError):
        ensure_single_currency([])


def test_ensure_single_currency_rejects_mixed_currencies() -> None:
    salaries = [_salary(1, "1000", "USD"), _salary(2, "2000", "GBP")]

    with pytest.raises(MixedCurrencyError):
        ensure_single_currency(salaries)


def test_total_salary_sums_amounts() -> None:
    salaries = [_salary(1, "1000.50"), _salary(2, "2000.25"), _salary(3, "500.00")]

    assert total_salary(salaries) == Decimal("3500.75")


def test_total_salary_is_exact_for_values_floats_cannot_represent() -> None:
    # 0.1 + 0.2 != 0.3 in binary floating point; Decimal must not lose precision.
    salaries = [_salary(1, "0.10"), _salary(2, "0.20")]

    assert total_salary(salaries) == Decimal("0.30")


def test_total_salary_handles_zero_valued_components() -> None:
    salaries = [_salary(1, "0"), _salary(2, "1000")]

    assert total_salary(salaries) == Decimal("1000")


def test_total_salary_rejects_mixed_currencies() -> None:
    salaries = [_salary(1, "1000", "USD"), _salary(2, "2000", "EUR")]

    with pytest.raises(MixedCurrencyError):
        total_salary(salaries)


def test_total_salary_rejects_empty_input() -> None:
    with pytest.raises(ValueError):
        total_salary([])


def test_average_salary_computes_the_mean() -> None:
    salaries = [_salary(1, "1000"), _salary(2, "2000"), _salary(3, "3000")]

    assert average_salary(salaries) == Decimal("2000")


def test_average_salary_preserves_precision_without_rounding() -> None:
    salaries = [_salary(1, "10"), _salary(2, "20"), _salary(3, "20")]

    result = average_salary(salaries)

    assert result == Decimal(50) / Decimal(3)
    assert result != Decimal("16.67")


def test_average_salary_of_single_zero_value_is_zero() -> None:
    salaries = [_salary(1, "0")]

    assert average_salary(salaries) == Decimal("0")


def test_average_salary_rejects_mixed_currencies() -> None:
    salaries = [_salary(1, "1000", "USD"), _salary(2, "2000", "INR")]

    with pytest.raises(MixedCurrencyError):
        average_salary(salaries)


def test_average_salary_rejects_empty_input() -> None:
    with pytest.raises(ValueError):
        average_salary([])


def test_min_salary_returns_the_smallest_amount() -> None:
    salaries = [_salary(1, "5000"), _salary(2, "1000"), _salary(3, "3000")]

    assert min_salary(salaries) == Decimal("1000")


def test_min_salary_handles_a_zero_valued_component() -> None:
    salaries = [_salary(1, "0"), _salary(2, "1000")]

    assert min_salary(salaries) == Decimal("0")


def test_min_salary_rejects_mixed_currencies() -> None:
    salaries = [_salary(1, "1000", "USD"), _salary(2, "2000", "GBP")]

    with pytest.raises(MixedCurrencyError):
        min_salary(salaries)


def test_min_salary_rejects_empty_input() -> None:
    with pytest.raises(ValueError):
        min_salary([])


def test_max_salary_returns_the_largest_amount() -> None:
    salaries = [_salary(1, "5000"), _salary(2, "1000"), _salary(3, "3000")]

    assert max_salary(salaries) == Decimal("5000")


def test_max_salary_handles_a_zero_valued_component() -> None:
    salaries = [_salary(1, "0"), _salary(2, "0")]

    assert max_salary(salaries) == Decimal("0")


def test_max_salary_rejects_mixed_currencies() -> None:
    salaries = [_salary(1, "1000", "USD"), _salary(2, "2000", "GBP")]

    with pytest.raises(MixedCurrencyError):
        max_salary(salaries)


def test_max_salary_rejects_empty_input() -> None:
    with pytest.raises(ValueError):
        max_salary([])


def test_single_salary_totals_and_range_all_equal_its_own_amount() -> None:
    salaries = [_salary(1, "4200.00")]

    assert total_salary(salaries) == Decimal("4200.00")
    assert average_salary(salaries) == Decimal("4200.00")
    assert min_salary(salaries) == Decimal("4200.00")
    assert max_salary(salaries) == Decimal("4200.00")
