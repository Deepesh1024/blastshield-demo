from cache import cache
from db import fetch_from_db

def get_product(product_id):

    # ISSUE
    # Cache stampede bug

    if product_id not in cache:

        data = fetch_from_db(product_id)

        cache[product_id] = data

    return cache[product_id]