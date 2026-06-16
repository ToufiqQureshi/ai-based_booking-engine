"""
Unit tests for per-hotel LLM token accounting (cost visibility).

These guard the math that powers AI cost monitoring — under-counting tokens
would hide an overspend until the monthly invoice. Pure functions only; no
Redis or network required.
"""
from app.ai_engine.ai_usage import _coerce_number, extract_total_tokens


class _Metrics:
    """Stand-in for an Agno RunResponse.metrics object."""
    def __init__(self, **kw):
        for k, v in kw.items():
            setattr(self, k, v)


class _Result:
    def __init__(self, metrics):
        self.metrics = metrics


def test_coerce_number_scalar_list_and_none():
    assert _coerce_number(42) == 42.0
    assert _coerce_number([10, 20, 30]) == 60.0          # per-message list
    assert _coerce_number((1, 2)) == 3.0
    assert _coerce_number(None) == 0.0
    assert _coerce_number("not-a-number") == 0.0


def test_extract_total_tokens_direct():
    result = _Result(_Metrics(total_tokens=1234))
    assert extract_total_tokens(result) == 1234


def test_extract_total_tokens_falls_back_to_input_plus_output():
    result = _Result(_Metrics(total_tokens=0, input_tokens=300, output_tokens=200))
    assert extract_total_tokens(result) == 500


def test_extract_total_tokens_handles_missing_metrics():
    assert extract_total_tokens(_Result(None)) == 0
    assert extract_total_tokens(object()) == 0


def test_extract_total_tokens_dict_metrics():
    result = _Result({"total_tokens": 777})
    assert extract_total_tokens(result) == 777
