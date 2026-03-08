import time

# External shipping service simulation

def notify_shipping(order):

    # ISSUE
    # External dependency with no retry mechanism

    time.sleep(2)

    return True