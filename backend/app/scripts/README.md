# Seed script

Populates the database with generated employee and salary records, for
local development and manual testing. Uses the same generator as
[`app/data_generation/`](../data_generation/) and the same database session
as the running app ([`app/db/session.py`](../db/session.py)), so no
generation logic or database configuration is duplicated here.

## Usage

```bash
cd backend
python -m app.scripts.seed
python -m app.scripts.seed --count 10000 --seed 42
python -m app.scripts.seed --reset --count 500
```

## Options

| Option | Default | Description |
|---|---|---|
| `--count` | `100` | Number of employees (and matching salaries) to generate. |
| `--seed` | unset | Random seed for reproducible output. Omit for non-deterministic data. |
| `--reset` | off | Delete all existing employee/salary records before seeding. **Development use only** — never runs automatically, and is not the default. |

## Required environment variables

None beyond what the app already needs: the database URL is read from
`PAYSCOPE_DATABASE_URL` (see `backend/README.md`), defaulting to a local
SQLite file if unset.

## Behavior when records already exist

By default, the command checks for existing employees first and refuses to
run if any are found — printing an error and exiting with a non-zero status
— rather than risking `employee_code` collisions or an ambiguous partial
dataset. Pass `--reset` to explicitly delete existing employee/salary
records and reseed from scratch; this is destructive and intended for
local development databases only.

## Transactions

Employees are inserted and flushed (so their ids are assigned) before the
matching salary rows are built, then both are committed together as one
transaction. Any error — an already-seeded check, or a failure partway
through insertion — rolls the whole transaction back (including a
requested `--reset`'s deletes), so a failed run never leaves partial data
committed.

## Verifying inserted data

```bash
python -c "
from sqlalchemy import func, select
from app.db.session import SessionLocal
from app.models.employee import Employee
from app.models.salary import Salary

with SessionLocal() as db:
    print('employees:', db.scalar(select(func.count()).select_from(Employee)))
    print('salaries:', db.scalar(select(func.count()).select_from(Salary)))
"
```

Or inspect rows directly against the default local SQLite database, e.g.
`sqlite3 payscope.db "select * from employees limit 5;"`.
