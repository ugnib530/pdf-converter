"""
core/rate_limit.py
Single slowapi Limiter instance imported by every router.
Routers apply it as a decorator:

    from core.rate_limit import limiter
    from core.config import DEFAULT_RATE_LIMIT

    @router.post("/my-tool")
    @limiter.limit(DEFAULT_RATE_LIMIT)
    async def my_tool(request: Request, ...):
        ...

The limiter is also registered on the FastAPI `app` instance in main.py.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
