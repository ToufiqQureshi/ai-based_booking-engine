# Database Developer Guide

Welcome to the Staybooker Data Layer!

As a Database Developer, your role is absolutely critical in ensuring our platform can handle 200+ hotels and 1000+ daily guest interactions without performance bottlenecks.

## The Architecture

We use a **Feature-Based Architecture**. This means database models are NOT stored in a single giant `models/` folder. Instead, they are distributed across the respective feature folders:
`backend/app/features/<feature_name>/models.py`

### 1. Model Registration (Crucial!)
Alembic can only generate migrations if it knows about the models. 
If a Backend Developer adds a new `models.py` inside a feature folder (e.g., `features/invoices/models.py`), **you must ensure it is imported in `backend/app/models/__init__.py`**. 

Our `env.py` uses `app.models.__init__.py` to discover all SQLModel metadata. If a model is not imported there, Alembic will delete the table assuming it was removed!

### 2. Alembic Migrations
This folder (`backend/alembic/`) is entirely yours.
When a schema changes:
1. Run `alembic revision --autogenerate -m "description"`
2. **Review the generated script** inside `alembic/versions/`. Alembic is not perfect (especially with column renaming or dropping).
3. Run `alembic upgrade head` to apply it.

### 3. Performance & Indexing Responsibilities
Because we expect high traffic:
- Ensure all heavily queried columns (e.g., `hotel_id`, `guest_id`, `booking_date`) have indexes: `index=True` in SQLModel.
- Watch out for N+1 query problems in the backend routers. Encourage backend devs to use `selectinload` or `joinedload`.
- Review `backend/app/core/database.py` for connection pooling optimizations. If the app runs out of connections under load, tune the SQLAlchemy `pool_size` and `max_overflow` here.

Always verify migrations locally before pushing to production!
