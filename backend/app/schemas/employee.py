from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.employee import EmploymentStatus
from app.schemas.salary import SalaryRead


class EmployeeCreate(BaseModel):
    """Request body for creating an employee.

    Mirrors `Employee`'s own writable columns; `id` is database-assigned
    and not part of the body. `employee_code`, `first_name`, `last_name`,
    `department`, `country`, and `job_title` are required and non-empty
    (`docs/requirements.md` FR-7.1: core employee fields must be "present
    and non-empty" when creating a record); `employment_status` is
    optional and defaults to `EmploymentStatus.ACTIVE`, matching the
    column's own default in `app.models.employee.Employee`.
    """

    employee_code: str = Field(
        ..., min_length=1, max_length=20, description="Unique employee identifier code."
    )
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    department: str = Field(..., min_length=1, max_length=100)
    country: str = Field(..., min_length=1, max_length=100)
    job_title: str = Field(..., min_length=1, max_length=150)
    employment_status: EmploymentStatus = Field(
        default=EmploymentStatus.ACTIVE, description="Defaults to 'active' if omitted."
    )


class EmployeeUpdate(BaseModel):
    """Request body for partially updating an employee (PATCH semantics).

    Every field is optional; only fields the client actually supplies are
    changed, and any field left out keeps its current value. `id`
    (database-assigned) and `employee_code` (the employee's unique
    identifier per FR-1.1 — nothing in `docs/requirements.md` documents it
    as editable, so it's treated the same as a natural key that doesn't
    move once assigned) are excluded and cannot be changed through this
    endpoint. The employee's salary is a separate resource, untouched
    here — see `PUT /employees/{employee_id}/salary` for that.

    Every mutable `Employee` column is `NOT NULL`, so there's no way to
    "clear" a field through this endpoint, only replace it with another
    value: a field explicitly sent as `null` is rejected (`ValueError`,
    surfaced as a `422`) rather than silently ignored or applied as a
    database-level null, which would otherwise fail as an unhandled
    integrity error instead of a clean validation error.
    """

    model_config = ConfigDict(extra="forbid")

    first_name: str | None = Field(None, min_length=1, max_length=100)
    last_name: str | None = Field(None, min_length=1, max_length=100)
    department: str | None = Field(None, min_length=1, max_length=100)
    country: str | None = Field(None, min_length=1, max_length=100)
    job_title: str | None = Field(None, min_length=1, max_length=150)
    employment_status: EmploymentStatus | None = None

    @field_validator(
        "first_name",
        "last_name",
        "department",
        "country",
        "job_title",
        "employment_status",
        mode="before",
    )
    @classmethod
    def _reject_explicit_null(cls, value: object) -> object:
        if value is None:
            raise ValueError("must not be null; omit the field instead to leave it unchanged.")
        return value


class EmployeeRead(BaseModel):
    """Employee fields returned by the API.

    Deliberately mirrors `app.models.employee.Employee`'s own columns
    (reusing its `EmploymentStatus` enum rather than redefining it) and
    excludes the `salary` relationship, which is out of scope for this
    endpoint.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_code: str
    first_name: str
    last_name: str
    department: str
    country: str
    job_title: str
    employment_status: EmploymentStatus


class EmployeeListItem(EmployeeRead):
    """One employee as returned by the employee list endpoint.

    Extends `EmployeeRead` with the employee's current salary
    (`docs/requirements.md` Section 8, Acceptance Criterion 1: the listing
    must show, at minimum, name, department, country, and salary amount +
    currency). Reuses `SalaryRead` unchanged so amount and currency are
    always represented together (FR-2.3) rather than as separate top-level
    fields. `salary` is `None` for an employee with no salary record —
    `docs/requirements.md` treats that as a valid state (e.g. the
    salary-range filters already document that such an employee simply
    can't match), so it stays in the listing rather than being excluded.
    """

    salary: SalaryRead | None = None


class EmployeeListResponse(BaseModel):
    """A page of employees, with pagination metadata."""

    items: list[EmployeeListItem]
    page: int
    page_size: int
    total: int
    has_next: bool


class EmployeeSalaryDetails(BaseModel):
    """An employee's core details together with their current salary.

    Nests the existing `EmployeeRead`/`SalaryRead` schemas unchanged,
    rather than flattening their fields into one object, so employee data
    and salary data stay clearly distinguished — each key's shape is
    exactly what `GET /employees/{id}` and `GET /employees/{id}/salary`
    already return on their own. `salary` is not `Optional`: an employee
    with no salary record is a `404` (see the `/details` route), matching
    the existing behavior of `GET /employees/{id}/salary` and
    `GET /employees/{id}/salary/summary` rather than introducing a third
    convention for the same "no salary yet" case.
    """

    employee: EmployeeRead
    salary: SalaryRead
