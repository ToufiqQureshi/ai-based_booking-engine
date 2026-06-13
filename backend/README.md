# Backend Developer Guide

Welcome to the Staybooker Backend (FastAPI)!

This project strictly follows a **Feature-Based Architecture**. Instead of having massive `api/` and `models/` folders where everything is mixed together, we organize code by the **business domain**.

## Folder Structure Rules

### 1. The `features/` Directory
All business logic, API endpoints, and database models belong inside `app/features/`.

If you are building a new feature (e.g., "Invoices"), create a folder under `app/features/`.
Inside it, you must encapsulate everything related to Invoices:

✅ **DO THIS:**
```text
app/features/invoices/
 ├── router.py         <-- All FastAPI @router.get() endpoints for invoices
 ├── models.py         <-- SQLModel/SQLAlchemy database models for invoices
 ├── schemas.py        <-- Pydantic validation schemas (if separate from models)
 └── services.py       <-- Business logic (e.g., generate_pdf(), send_email())
```

❌ **DO NOT DO THIS:**
Do not put the endpoints in `app/api/v1/invoices.py` and the models in `app/models/invoices.py`. We no longer use that layered approach.

### 2. The `core/` Directory
This folder is strictly for cross-cutting technical concerns that do not belong to a specific business feature.
Examples: `database.py` (connection pooling), `security.py` (JWT tokens), `config.py` (environment variables).

### 3. Mounting your Router
Once your `router.py` is ready inside your feature, you must mount it in `app/main.py`:
```python
from app.features.invoices.router import router as invoices_router

app.include_router(invoices_router, prefix="/api/v1/invoices", tags=["Invoices"])
```

## Database Rules
- If your feature requires new database tables, define them in `models.py` inside your feature folder.
- Ensure you import your models into `app/models/__init__.py` so that Alembic can auto-detect them for migrations.
- **Never bypass the Database Developer.** If you change a model, let the DB Dev know so they can generate the Alembic migration!
