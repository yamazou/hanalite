from pydantic import BaseModel, Field


class CompanyLoginOut(BaseModel):
    co_id: int
    company_cd: str
    company_nm: str


class CompanyMasterOut(BaseModel):
    co_id: int
    company_cd: str
    company_nm: str
    created_at: str | None = None
    updated_at: str | None = None


class CompanyMasterCreate(BaseModel):
    company_cd: str = Field(min_length=1, max_length=50)
    company_nm: str = Field(min_length=1, max_length=200)


class CompanyMasterUpdate(BaseModel):
    company_cd: str | None = Field(default=None, min_length=1, max_length=50)
    company_nm: str | None = Field(default=None, min_length=1, max_length=200)


class LoginRequest(BaseModel):
    company_cd: str = Field(min_length=1, max_length=50)
    user_cd: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=128)


class UserSessionOut(BaseModel):
    user_id: int
    user_cd: str
    user_nm: str
    co_id: int
    company_cd: str
    company_nm: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserSessionOut


class UserMasterOut(BaseModel):
    user_id: int
    co_id: int
    company_cd: str
    company_nm: str
    user_cd: str
    user_nm: str
    is_active: bool
    created_at: str | None = None
    updated_at: str | None = None


class UserMasterCreate(BaseModel):
    company_cd: str = Field(min_length=1, max_length=50)
    user_cd: str = Field(min_length=1, max_length=50)
    user_nm: str = Field(default="", max_length=200)
    password: str = Field(min_length=1, max_length=128)
    is_active: bool = True


class UserMasterUpdate(BaseModel):
    user_nm: str | None = None
    password: str | None = Field(default=None, min_length=1, max_length=128)
    is_active: bool | None = None
