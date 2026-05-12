import asyncio
import os
import sys

# Add the current directory to sys.path to import app
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.core.database import engine
from sqlalchemy import text

async def fix_database():
    print("Connecting to database to add missing columns...")
    try:
        async with engine.begin() as conn:
            # 1. Add photos column to hotels table
            print("Checking 'hotels' table for 'photos' column...")
            await conn.execute(text("ALTER TABLE hotels ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb"))
            print("Column 'photos' added successfully or already exists.")
            
            # 2. Add photos column to any other tables if needed? 
            # RoomType already had photos as JSON in its definition, let's ensure it's there too
            await conn.execute(text("ALTER TABLE room_types ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb"))
            
            print("Database fix completed!")
    except Exception as e:
        print(f"CRITICAL ERROR during database fix: {e}")

if __name__ == "__main__":
    asyncio.run(fix_database())
