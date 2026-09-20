from decimal import Decimal

from sqlalchemy import CheckConstraint, ForeignKey, Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Salary(Base):
    """An employee's current salary (requirements.md FR-2.1-FR-2.3).

    The initial version supports exactly one active salary per employee;
    salary history is explicitly out of scope (requirements.md Section 6.2).
    The unique constraint on employee_id enforces that one-to-one
    relationship at the database level.
    """

    __tablename__ = "salaries"
    __table_args__ = (
        CheckConstraint("amount >= 0", name="ck_salaries_amount_non_negative"),
        Index("ix_salaries_currency_amount", "currency", "amount"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int] = mapped_column(
        ForeignKey("employees.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    # Numeric (fixed-point), never Float, so monetary values are exact.
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    # ISO 4217 currency code, required alongside every amount (requirements.md
    # Section 5) so amounts in different currencies are never conflated.
    currency: Mapped[str] = mapped_column(String(3), nullable=False)

    employee = relationship("Employee", back_populates="salary")
