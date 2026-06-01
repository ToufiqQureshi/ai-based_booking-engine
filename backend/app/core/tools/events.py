import concurrent.futures
from langchain_community.tools import DuckDuckGoSearchRun
from langchain_core.tools import tool

# DuckDuckGoSearchRun uses the sync `duckduckgo_search` SDK which makes
# blocking HTTP calls. We share a small executor with weather.py so that
# tools invoked from the async agent don't pin the event loop.
# Importing the executor from weather.py keeps the thread pool unified.
try:
    from app.core.tools.weather import _sync_io_executor
except ImportError:  # pragma: no cover - circular import safety
    _sync_io_executor = concurrent.futures.ThreadPoolExecutor(
        max_workers=2,
        thread_name_prefix="events-tool",
    )


def _get_local_events_sync(city: str) -> str:
    """Blocking body of get_local_events. Always run via the executor."""
    search = DuckDuckGoSearchRun()
    query = f"upcoming big events concerts festivals in {city} next month"
    try:
        results = search.run(query)
        if not results:
            return f"No major events found in {city} for the next month."
        return f"Event Search Results for {city}:\n{results}\n(Analyze these to see if they drive hotel demand)."
    except Exception as e:
        return f"Event search failed: {type(e).__name__}: {e}"


@tool
def get_local_events(city: str) -> str:
    """
    Search for upcoming events, concerts, or festivals in a city to predict demand.

    Implementation note: DuckDuckGoSearchRun is sync. We run it through
    the shared sync-I/O thread-pool executor so it doesn't block the
    agent's async event loop while waiting on the upstream search API.
    """
    future = _sync_io_executor.submit(_get_local_events_sync, city)
    try:
        return future.result(timeout=15.0)
    except concurrent.futures.TimeoutError:
        return f"Event search timed out for {city}"
    except Exception as e:
        return f"Event search failed: {type(e).__name__}: {e}"
