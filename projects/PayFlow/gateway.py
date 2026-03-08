import random

# Simulated payment gateway

def charge_card(user_id, amount):

    # Random failure to simulate real gateway

    if random.random() < 0.5:
        raise Exception("Gateway timeout")

    return True