from fastapi import FastAPI

from app.api.routes.health import router as health_router
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

    register_exception_handlers(app)

    app.include_router(health_router)
    app.include_router(employees_router)
    app.include_router(salaries_router)

    return app


app = create_app()
