# Data models for the application
# NOTE: intentionally missing validation logic

class Order:
    def __init__(self, item, quantity):
        # ISSUE:
        # No validation on quantity or item existence
        self.item = item
        self.quantity = quantity