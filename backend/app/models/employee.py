import enum

from sqlalchemy import Enum, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class EmploymentStatus(str, enum.Enum):
    """Employment status values (requirements.md FR-1.1)."""

    ACTIVE = "active"
    INACTIVE = "inactive"
    TERMINATED = "terminated"


class Employee(Base):
    """Core employee attributes (requirements.md FR-1.1).

    Salary is stored separately in `Salary`, matching the requirements'
    treatment of employee and salary information as distinct concerns
    (architecture.md Section 6.2).
    """

    __tablename__ = "employees"
    __table_args__ = (
        Index("ix_employees_last_name_first_name", "last_name", "first_name"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    department: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    country: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    job_title: Mapped[str] = mapped_column(String(150), nullable=False)
    employment_status: Mapped[EmploymentStatus] = mapped_column(
        Enum(EmploymentStatus, native_enum=False, length=20, name="employment_status"),
        nullable=False,
        default=EmploymentStatus.ACTIVE,
    )

    # Typed via the string form (rather than Mapped[...]) to keep the
    # cross-module Employee<->Salary forward reference simple; SQLAlchemy
    # resolves "Salary" through the shared declarative registry once both
    # model modules have been imported (see app/models/__init__.py).
    salary = relationship(
        "Salary", back_populates="employee", uselist=False, cascade="all, delete-orphan"
    )
