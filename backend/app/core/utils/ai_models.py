"""Single source of truth for platform-default LLM model ids.

Groq deprecated llama-3.1-70b-versatile earlier in 2026, then announced on
2026-06-17 that llama-3.3-70b-versatile AND llama-3.1-8b-instant shut down on
2026-08-16 (https://console.groq.com/docs/deprecations). Those ids were
hardcoded in ~10 files, so every deprecation meant a scavenger hunt. All
defaults now come from here; per-hotel overrides (hotel.ai_model /
integration_settings.ai_model) still win.

The regression test tests/api/v1/test_ai_models.py greps app/ for the
decommissioned ids (this file is exempt — it names them on purpose).
"""

# Groq's recommended replacements per the deprecation notice.
GROQ_LARGE_MODEL = "openai/gpt-oss-120b"   # hotelier analytics team leader
GROQ_SMALL_MODEL = "openai/gpt-oss-20b"    # guest/WhatsApp bots, cheap tasks

DECOMMISSIONED_GROQ_MODELS = (
    "llama-3.1-70b-versatile",
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
)
