from fastapi import APIRouter
from service import get_product

router = APIRouter()

@router.get("/product/{product_id}")
def product(product_id: str):

    return get_product(product_id)