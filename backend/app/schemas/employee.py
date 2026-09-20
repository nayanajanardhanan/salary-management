from pydantic import BaseModel, ConfigDict, Field

from app.models.employee import EmploymentStatus


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


class EmployeeListResponse(BaseModel):
    """A page of employees, with pagination metadata."""

    items: list[EmployeeRead]
    page: int
    page_size: int
    total: int
    has_next: bool
