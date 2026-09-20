from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.health import router as health_router
from app.api.v1.routes.analytics import router as analytics_router
from app.api.v1.routes.employees import router as employees_router
from app.api.v1.routes.salaries import router as salaries_router
from app.core.config import get_settings
from app.core.errors import register_exception_handlers


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        description="API for managing employee salary records.",
        version="0.1.0",
    )

    # Required for the frontend SPA (served from its own origin, e.g. the
    # Vite dev server) to call this API from a browser at all: without it,
    # every cross-origin request's preflight `OPTIONS` fails before the
    # actual request is ever sent. `allow_credentials=False` since auth uses
    # a bearer token (via the `Authorization` header, not cookies), so no
    # credentialed-request restrictions apply.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)

    app.include_router(health_router)
    app.include_router(employees_router)
    app.include_router(salaries_router)
    app.include_router(analytics_router)

    return app


app = create_app()
