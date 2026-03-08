from fastapi import APIRouter
from db import inventory, orders
from models import Order

router = APIRouter()

@router.post("/create_order")
def create_order(data: dict):

    # ISSUE 1
    # Direct dictionary access without validation
    # Raises KeyError if item missing

    item = data["item"]

    # ISSUE 2
    # Quantity not validated (could be negative)
    qty = data["quantity"]

    # ISSUE 3
    # CRITICAL: non-atomic inventory update
    # In concurrent traffic this causes lost updates

    inventory[item] -= qty

    order = Order(item, qty)
    orders.append(order)

    return {"message": "order created"}