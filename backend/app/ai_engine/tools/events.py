import concurrent.futures
from duckduckgo_search import DDGS

try:
    from app.ai_engine.tools.weather import _sync_io_executor
except ImportError:
    _sync_io_executor = concurrent.futures.ThreadPoolExecutor(
        max_workers=2,
        thread_name_prefix="events-tool",
    )


def _get_local_events_sync(city: str) -> str:
    """Blocking body of get_local_events. Always run via the executor."""
    query = f"upcoming big events concerts festivals in {city} next month"
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=5))
        if not results:
            return f"No major events found in {city} for the next month."
        formatted = "\n".join([f"- {r.get('title','')}: {r.get('body','')}" for r in results])
        return f"Event Search Results for {city}:\n{formatted}\n(Analyze these to see if they drive hotel demand)."
    except Exception as e:
        return f"Event search failed: {type(e).__name__}: {e}"


def get_local_events(city: str) -> str:
    """
    Search for upcoming events, concerts, or festivals in a city to predict demand.
    """
    future = _sync_io_executor.submit(_get_local_events_sync, city)
    try:
        return future.result(timeout=15.0)
    except concurrent.futures.TimeoutError:
        return f"Event search timed out for {city}"
    except Exception as e:
        return f"Event search failed: {type(e).__name__}: {e}"
