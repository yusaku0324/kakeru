"""Auth-related schemas."""

from typing import Literal

from .base import BaseModel, EmailStr, Field, List, Optional, UUID, datetime


class AuthRequestLink(BaseModel):
    email: EmailStr
    scope: Literal["dashboard", "site"] = "dashboard"


class AuthVerifyRequest(BaseModel):
    token: str


class AuthTestLoginRequest(BaseModel):
    email: EmailStr
    display_name: Optional[str] = None
    scope: Literal["dashboard", "site"] = "site"


class UserPublic(BaseModel):
    id: UUID
    email: EmailStr
    display_name: Optional[str] = None
    created_at: datetime
    last_login_at: Optional[datetime] = None


class AuthSessionStatus(BaseModel):
    authenticated: bool
    site_authenticated: bool = False
    dashboard_authenticated: bool = False
    scopes: List[str] = Field(default_factory=list)
    user: Optional[UserPublic] = None
