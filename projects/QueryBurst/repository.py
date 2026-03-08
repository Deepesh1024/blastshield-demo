from db import get_connection

def get_user(user_id):

    conn = get_connection()

    cursor = conn.cursor()

    cursor.execute(
        "SELECT * FROM users WHERE id=?",
        (user_id,)
    )

    result = cursor.fetchone()

    # ISSUE
    # Connection never closed
    # Causes connection leak

    return result