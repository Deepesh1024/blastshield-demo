import sqlite3

# ISSUE
# Each request creates a new DB connection
# No connection pooling

def get_connection():
    return sqlite3.connect("test.db")