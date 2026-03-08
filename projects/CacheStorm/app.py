from fastapi import FastAPI
from routes import router

app = FastAPI(title="CacheStorm API")

app.include_router(router)