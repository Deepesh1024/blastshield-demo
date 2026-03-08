from gateway import charge_card

# Payment processing logic

def process_payment(user_id, amount):

    # ISSUE
    # Blind retry loop with no backoff
    # In production this causes retry storms

    while True:
        result = charge_card(user_id, amount)

        if result:
            return True