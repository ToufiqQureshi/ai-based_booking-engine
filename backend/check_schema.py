import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import get_settings
from app.models import *

async def check_schema():
    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL, connect_args={'prepared_statement_cache_size': 0, 'statement_cache_size': 0})
    
    async with engine.begin() as conn:
        result = await conn.execute(text("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'"))
        
        db_schema = {}
        for row in result:
            t_name, c_name = row
            if t_name not in db_schema:
                db_schema[t_name] = set()
            db_schema[t_name].add(c_name)
            
        print('Database Schema Extracted.')
        
        from sqlmodel import SQLModel
        metadata = SQLModel.metadata
        
        missing_columns = []
        missing_tables = []
        
        for table_name, table in metadata.tables.items():
            if table_name not in db_schema:
                missing_tables.append(table_name)
                continue
                
            for column in table.columns:
                if column.name not in db_schema[table_name]:
                    missing_columns.append((table_name, column.name, str(column.type)))
                    
        if missing_tables:
            print('Missing Tables:', missing_tables)
        else:
            print('All tables exist.')
            
        if missing_columns:
            print('Missing Columns:')
            for t, c, ty in missing_columns:
                print(f'- {t}.{c} ({ty})')
        else:
            print('All columns exist.')

if __name__ == "__main__":
    asyncio.run(check_schema())
