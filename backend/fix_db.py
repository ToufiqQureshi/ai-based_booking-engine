import asyncio
from sqlalchemy import text
from app.core.database import engine

async def fix_database():
    print("Checking and fixing database schema...")
    async with engine.begin() as conn:
        # Add missing columns to hotels table
        columns_to_add = [
            ("feature_rate_shopper", "BOOLEAN DEFAULT TRUE"),
            ("feature_ai_agent", "BOOLEAN DEFAULT TRUE"),
            ("feature_guest_bot", "BOOLEAN DEFAULT TRUE"),
            ("is_active", "BOOLEAN DEFAULT TRUE")
        ]
        
        for col_name, col_def in columns_to_add:
            try:
                # Check if column exists
                # PostgreSQL specific check
                check_sql = text(f"SELECT column_name FROM information_schema.columns WHERE table_name='hotels' AND column_name='{col_name}';")
                res = await conn.execute(check_sql)
                if not res.scalar():
                    print(f"Adding column {col_name}...")
                    await conn.execute(text(f"ALTER TABLE hotels ADD COLUMN {col_name} {col_def};"))
                else:
                    print(f"Column {col_name} already exists.")
            except Exception as e:
                print(f"Error adding {col_name}: {e}")

    print("Database fix complete.")

if __name__ == "__main__":
    asyncio.run(fix_database())
