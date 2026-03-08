from fastapi import APIRouter
from payment import process_payment

router = APIRouter()

@router.post("/pay")
def pay(data: dict):

    user = data["user"]
    amount = data["amount"]

    process_payment(user, amount)

    return {"status": "success"}