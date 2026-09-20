from pydantic import BaseModel, ConfigDict

from app.models.employee import EmploymentStatus


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
