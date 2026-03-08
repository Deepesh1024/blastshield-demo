from fastapi import APIRouter
from repository import get_user

router = APIRouter()

@router.get("/user/{user_id}")
def fetch_user(user_id: int):

    # Under high traffic this leaks DB connections

    return {"user": get_user(user_id)}