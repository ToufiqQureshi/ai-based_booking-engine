import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env')

db_url = os.getenv('DATABASE_URL')
# sqlalchemy URL is postgresql+asyncpg://... let's replace it with postgresql://
if db_url.startswith('postgresql+asyncpg://'):
    db_url = db_url.replace('postgresql+asyncpg://', 'postgresql://')

conn = psycopg2.connect(db_url)
cur = conn.cursor()
cur.execute("SELECT email, role FROM users WHERE email = 'tech.revmerito@gmail.com'")
for row in cur.fetchall():
    print(f'User: {row[0]} | Role: {row[1]}')

cur.close()
conn.close()
