from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class SalaryRead(BaseModel):
    """Salary fields returned by the API.

    Mirrors `app.models.salary.Salary`'s own columns, excluding the
    salary's own surrogate `id` (an internal detail no client needs,
    since salaries are always addressed via their employee) and the
    `employee` relationship.
    """

    model_config = ConfigDict(from_attributes=True)

    employee_id: int
    amount: Decimal
    currency: str
