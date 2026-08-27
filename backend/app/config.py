import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    # Confirmed against ai.google.dev/gemini-api/docs/models (GEM-3 risk: lineup
    # changes fast — reconfirm before relying on these in production).
    gemini_flash_model: str = os.getenv("GEMINI_FLASH_MODEL", "gemini-3.6-flash")
    gemini_pro_model: str = os.getenv("GEMINI_PRO_MODEL", "gemini-2.5-pro")
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    # Groq's lineup changes fast too (llama-3.1-8b-instant / llama-3.3-70b-versatile
    # were removed from availability after these defaults were first set) —
    # reconfirm against console.groq.com/docs/models if the fallback starts
    # returning 404 model_not_found.
    groq_flash_model: str = os.getenv("GROQ_FLASH_MODEL", "openai/gpt-oss-20b")
    groq_pro_model: str = os.getenv("GROQ_PRO_MODEL", "openai/gpt-oss-120b")
    cors_origin: str = os.getenv("CORS_ORIGIN", "http://localhost:5173")
    request_timeout_seconds: float = float(os.getenv("REQUEST_TIMEOUT_SECONDS", "30"))
    request_max_retries: int = int(os.getenv("REQUEST_MAX_RETRIES", "3"))
    # GEM-3: use Pro tier for notes summaries once the pasted text crosses this
    # length, since longer notes benefit from the stronger reasoning model.
    notes_pro_tier_char_threshold: int = int(os.getenv("NOTES_PRO_TIER_CHAR_THRESHOLD", "4000"))


settings = Settings()
