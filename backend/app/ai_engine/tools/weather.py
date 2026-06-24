import asyncio
import concurrent.futures
import openmeteo_requests
import requests_cache
from retry_requests import retry
from datetime import date

# Open-Meteo Client Setup.
# NOTE: openmeteo_requests, requests_cache, and retry_requests are all
# SYNC clients. Calling them from inside an async event loop blocks the
# loop for ~100-500ms per call. We run them through a dedicated
# ThreadPoolExecutor so the agent's async graph can keep doing other
# work (LLM calls, DB queries) while the weather API responds. This is
# a minimal fix — the proper long-term solution is to replace the SDK
# with raw httpx.AsyncClient calls (tracked in P4).
cache_session = requests_cache.CachedSession(backend='memory', expire_after=3600)
retry_session = retry(cache_session, retries=5, backoff_factor=0.2)
openmeteo = openmeteo_requests.Client(session=retry_session)

# Dedicated executor for sync I/O tools. Sizing is intentionally small
# because each call holds a thread for the duration of the upstream HTTP
# request; raise if your concurrency requirements grow.
_sync_io_executor = concurrent.futures.ThreadPoolExecutor(
    max_workers=4,
    thread_name_prefix="weather-tool",
)


def _get_weather_forecast_sync(city: str) -> str:
    """Blocking body of get_weather_forecast. Always run via the executor."""
    try:
        geo_url = f"https://geocoding-api.open-meteo.com/v1/search?name={city}&count=1&language=en&format=json"
        geo_res = retry_session.get(geo_url).json()

        if not geo_res.get("results"):
            return f"Could not find coordinates for {city}."

        lat = geo_res["results"][0]["latitude"]
        lon = geo_res["results"][0]["longitude"]

        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": lat,
            "longitude": lon,
            "daily": "weather_code,temperature_2m_max,precipitation_sum",
            "timezone": "auto"
        }

        responses = openmeteo.weather_api(url, params=params)
        response = responses[0]

        daily = response.Daily()
        daily_weather_code = daily.Variables(0).ValuesAsNumpy()
        daily_temp_max = daily.Variables(1).ValuesAsNumpy()

        def get_weather_desc(code):
            if code <= 3: return "Sunny/Cloudy"
            if code <= 48: return "Foggy"
            if code <= 67: return "Rainy"
            if code <= 77: return "Snowy"
            return "Stormy"

        forecast_summary = f"Weather Forecast for {city}:\n"
        for i in range(5):
            desc = get_weather_desc(daily_weather_code[i])
            temp = int(daily_temp_max[i])
            forecast_summary += f"- Day {i+1}: {desc}, Max {temp}°C\n"

        return forecast_summary
    except Exception as e:
        return f"Weather fetch failed: {str(e)}"


def get_weather_forecast(city: str) -> str:
    """
    Get weather forecast for a specific city for the next 7 days.
    Useful for predicting demand (e.g., Rain = Low, Sunny = High).

    Implementation note: the underlying Open-Meteo SDK is sync; we run
    it through a thread-pool executor so it does not block the agent's
    async event loop.
    """
    future = _sync_io_executor.submit(_get_weather_forecast_sync, city)
    # Bound the wait so a hung upstream can't deadlock the agent.
    try:
        return future.result(timeout=10.0)
    except concurrent.futures.TimeoutError:
        return f"Weather fetch timed out for {city}"
    except Exception as e:
        return f"Weather fetch failed: {type(e).__name__}: {e}"
