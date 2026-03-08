# Simple cache dictionary

cache = {}

# ISSUE
# No locking or request coalescing
# When cache expires, all requests hit DB