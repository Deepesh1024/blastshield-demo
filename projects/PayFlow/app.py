from fastapi import FastAPI
from routes import router

app = FastAPI(title="PayFlow Service")

app.include_router(router)