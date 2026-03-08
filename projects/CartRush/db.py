# Fake in-memory database layer
# This simulates inventory storage

inventory = {
    "laptop": 10,
    "mouse": 50,
    "keyboard": 30
}

orders = []

# ISSUE:
# No locking mechanism around shared state
# Multiple threads updating inventory simultaneously
# will cause corrupted inventory counts