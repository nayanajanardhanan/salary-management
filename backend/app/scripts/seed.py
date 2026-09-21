"""Seed the database with generated employee and salary records.

    python -m app.scripts.seed [--count N] [--seed N] [--reset]

Reuses `app.data_generation.generate_employee_dataset` for the records and
`app.db.session.SessionLocal` for the database session — no generation
logic or database configuration is duplicated here. See
`app/scripts/README.md` for full usage, options, and behavior details.
"""

import argparse
import sys
from dataclasses import dataclass

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.data_generation import (
    GeneratedEmployee,
    GeneratedSalary,
    generate_employee_dataset,
)
from app.db.session import SessionLocal
from app.models.employee import Employee
from app.models.hr_user import HrUser
from app.models.salary import Salary
from app.services import auth_service

DEFAULT_EMPLOYEE_COUNT = 100


@dataclass(frozen=True)
class SeedResult:
    employees_inserted: int
    salaries_inserted: int


@dataclass(frozen=True)
class HrUserSeedResult:
    username: str
    created: bool
    """`False` when an HR user with this `username` or `email` already
    existed — `seed_hr_user` is a no-op in that case (see its docstring)."""


class DatabaseAlreadySeededError(RuntimeError):
    """Raised when the database already has employees and `reset` was not requested."""


def seed_database(
    session: Session, *, count: int, seed: int | None = None, reset: bool = False
) -> SeedResult:
    """Insert `count` generated employees, and one salary each, into `session`.

    Raises `DatabaseAlreadySeededError` if the database already contains
    employees and `reset` is False (see `app/scripts/README.md` for why).
    Employees are flushed before salaries are built, so each salary can be
    linked to its employee's assigned id without a per-row query. Commits
    only after every row is added successfully; any failure rolls back the
    entire transaction (including a requested reset) and re-raises, so a
    failed run never leaves partial data committed.
    """
    existing_employee_count = session.scalar(select(func.count()).select_from(Employee))

    if existing_employee_count and not reset:
        raise DatabaseAlreadySeededError(
            f"Database already has {existing_employee_count} employee(s). "
            "Pass reset=True (CLI: --reset) to clear existing data first."
        )

    try:
        if reset and existing_employee_count:
            session.execute(delete(Salary))
            session.execute(delete(Employee))

        dataset = generate_employee_dataset(count, seed=seed)

        employees = [_to_employee(record) for record in dataset.employees]
        session.add_all(employees)
        session.flush()  # Assigns Employee.id without ending the transaction.

        employee_id_by_code = {employee.employee_code: employee.id for employee in employees}
        salaries = [_to_salary(record, employee_id_by_code) for record in dataset.salaries]
        session.add_all(salaries)

        session.commit()
    except Exception:
        session.rollback()
        raise

    return SeedResult(employees_inserted=len(employees), salaries_inserted=len(salaries))


def _to_employee(record: GeneratedEmployee) -> Employee:
    # record.email has no matching Employee column today, so it is
    # intentionally not carried over (see app/data_generation).
    return Employee(
        employee_code=record.employee_code,
        first_name=record.first_name,
        last_name=record.last_name,
        department=record.department,
        country=record.country,
        job_title=record.job_title,
        employment_status=record.employment_status,
    )


def _to_salary(record: GeneratedSalary, employee_id_by_code: dict[str, int]) -> Salary:
    return Salary(
        employee_id=employee_id_by_code[record.employee_code],
        amount=record.amount,
        currency=record.currency,
    )


def seed_hr_user(session: Session, *, username: str, email: str, password: str) -> HrUserSeedResult:
    """Idempotently ensure one development HR user exists.

    If an `HrUser` with `username` or `email` already exists, this is a
    no-op — returns that existing user's username with `created=False`,
    rather than raising or creating a second, conflicting row. Running the
    seed command (`main`, below) repeatedly therefore never creates
    duplicate HR users. `password` is hashed (`auth_service.hash_password`)
    before storage and never logged; the caller (`main`) never prints it
    either.

    The check-then-insert has the same benign race as
    `employee_service.create_employee`: a concurrent seed run could pass the
    check before either commits, so the database's own unique constraints on
    `username`/`email` are the final guard — a resulting `IntegrityError` is
    rolled back and re-resolved to the row that won the race, rather than
    surfacing as a raw database error.
    """
    existing = auth_service.get_user_by_username_or_email(
        session, username
    ) or auth_service.get_user_by_username_or_email(session, email)
    if existing is not None:
        return HrUserSeedResult(username=existing.username, created=False)

    user = HrUser(username=username, email=email, password_hash=auth_service.hash_password(password))
    session.add(user)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        existing = auth_service.get_user_by_username_or_email(
            session, username
        ) or auth_service.get_user_by_username_or_email(session, email)
        if existing is None:
            raise
        return HrUserSeedResult(username=existing.username, created=False)

    return HrUserSeedResult(username=user.username, created=True)


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed the database with generated employee/salary data."
    )
    parser.add_argument(
        "--count",
        type=int,
        default=DEFAULT_EMPLOYEE_COUNT,
        help=f"Number of employees to generate (default: {DEFAULT_EMPLOYEE_COUNT}).",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Random seed for reproducible output (default: unset, non-deterministic).",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help=(
            "Delete all existing employee/salary records before seeding. "
            "Development use only; never runs automatically and is not the default."
        ),
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)

    if args.count < 0:
        print("error: --count must be zero or greater", file=sys.stderr)
        return 2

    exit_code = 0
    session = SessionLocal()
    try:
        try:
            result = seed_database(session, count=args.count, seed=args.seed, reset=args.reset)
            print(
                f"Seeded {result.employees_inserted} employee(s) and "
                f"{result.salaries_inserted} salary record(s)."
            )
        except DatabaseAlreadySeededError as exc:
            print(f"error: {exc}", file=sys.stderr)
            exit_code = 1

        # Seeded independently of the employee/salary outcome above (and
        # never affected by `--reset`), so a plain re-run of this command
        # still ensures the development HR login exists without requiring
        # `--reset`. Skipped, not a hard failure, when no password is
        # configured (see `Settings.hr_seed_password`) — running the seed
        # script must keep working for anyone who hasn't set up HR login
        # credentials yet. The password itself is never printed.
        settings = get_settings()
        if settings.hr_seed_password:
            hr_result = seed_hr_user(
                session,
                username=settings.hr_seed_username,
                email=settings.hr_seed_email,
                password=settings.hr_seed_password,
            )
            if hr_result.created:
                print(f"Seeded HR user '{hr_result.username}'.")
            else:
                print(f"HR user '{hr_result.username}' already exists; skipped.")
        else:
            print(
                "Skipped HR user seeding: PAYSCOPE_HR_SEED_PASSWORD is not set.",
                file=sys.stderr,
            )
    finally:
        session.close()

    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
