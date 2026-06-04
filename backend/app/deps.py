from contextvars import ContextVar, Token
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.types import ASGIApp, Receive, Scope, Send

from app.auth_security import decode_access_token
from app.config import settings
from app.database import get_db
from app.models.auth import Company, User
from app.tenant import TenantContext

_bearer = HTTPBearer(auto_error=False)
_tenant_ctx: ContextVar[TenantContext | None] = ContextVar("hanalite_tenant", default=None)


def get_tenant() -> TenantContext:
    ctx = _tenant_ctx.get()
    if ctx is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return ctx


def get_optional_credentials(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> str | None:
    if credentials is None or credentials.scheme.lower() != "bearer":
        return None
    return credentials.credentials


def _tenant_from_token(token: str) -> TenantContext | None:
    try:
        payload = decode_access_token(token)
        return TenantContext(
            co_id=int(payload["co_id"]),
            user_id=int(payload["sub"]),
            user_cd=str(payload["user_cd"]),
            company_cd=str(payload["company_cd"]),
        )
    except (ValueError, KeyError, TypeError):
        return None


def _extract_bearer_header(request: Request) -> str | None:
    auth = request.headers.get("Authorization", "")
    if not auth.lower().startswith("bearer "):
        return None
    return auth[7:].strip() or None


def _api_path_requires_tenant(request: Request) -> bool:
    path = request.url.path
    api = settings.api_prefix.rstrip("/")
    if not path.startswith(api):
        return False
    if path == f"{api}/health":
        return False
    if path == f"{api}/auth/companies":
        return False
    if path == f"{api}/auth/login" and request.method.upper() == "POST":
        return False
    return True


class TenantContextMiddleware:
    """Bind tenant ContextVar for the full request in one async context.

    FastAPI runs sync route handlers in a thread pool; a generator dependency that
    resets ContextVar in ``finally`` can run in a different context than ``set``,
    which raises "Token was created in a different Context".
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        from starlette.requests import Request

        request = Request(scope, receive=receive)
        reset_token: Token[TenantContext | None] | None = None
        if _api_path_requires_tenant(request):
            bearer = _extract_bearer_header(request)
            if bearer:
                ctx = _tenant_from_token(bearer)
                if ctx is not None:
                    request.state.tenant = ctx
                    reset_token = _tenant_ctx.set(ctx)
        try:
            await self.app(scope, receive, send)
        finally:
            if reset_token is not None:
                _tenant_ctx.reset(reset_token)


def require_tenant(
    db: Annotated[Session, Depends(get_db)],
    token: Annotated[str | None, Depends(get_optional_credentials)],
) -> TenantContext:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    ctx = _tenant_from_token(token)
    if ctx is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.scalars(
        select(User).where(
            User.user_id == ctx.user_id,
            User.co_id == ctx.co_id,
            User.deleted_at.is_(None),
            User.is_active.is_(True),
        )
    ).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User inactive or not found.",
        )
    company = db.scalars(
        select(Company).where(
            Company.co_id == ctx.co_id,
            Company.deleted_at.is_(None),
        )
    ).first()
    if company is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Company not found.")
    return TenantContext(
        co_id=ctx.co_id,
        user_id=user.user_id,
        user_cd=user.user_cd,
        company_cd=company.company_cd,
    )
