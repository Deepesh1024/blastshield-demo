from fastapi import FastAPI
from routes import router

# FastAPI application entry point
# Registers all API routes

app = FastAPI(title="CartRush API")

app.include_router(router)

@app.get("/health")
def health():
    return {"status": "ok"}