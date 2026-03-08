import time

def fetch_from_db(key):

    # Simulate slow DB

    time.sleep(3)

    return {"value": key}