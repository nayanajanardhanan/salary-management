from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class HrUser(Base):
    """An HR user authorized to sign in to PayScope.

    The only user type the application has today — no role-based access
    control beyond it (see `docs/requirements.md`'s explicit exclusion of
    "role-based permission tiers beyond a single authenticated HR manager
    role"). `password_hash` never stores a plaintext password (see
    `app.services.auth_service.hash_password`) and is never included in an
    API response schema (`app.schemas.auth`).
    """

    __tablename__ = "hr_users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
