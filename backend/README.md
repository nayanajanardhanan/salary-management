# PayScope Backend

FastAPI backend for PayScope. See [`docs/architecture.md`](../docs/architecture.md)
for the full technical architecture.

This initial version is scaffolding only: application setup, configuration,
and a health-check endpoint. Employee/salary functionality and database
integration are added in later steps.

## Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate      # Windows
# source .venv/bin/activate   # macOS/Linux

pip install -e ".[dev]"
copy .env.example .env        # Windows
# cp .env.example .env          # macOS/Linux
```

## Run the app

```bash
uvicorn app.main:app --reload
```

Then check `GET http://127.0.0.1:8000/health`.

## Run tests

```bash
pytest
```
