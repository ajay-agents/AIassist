import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_flash_model: str = os.getenv("GEMINI_FLASH_MODEL", "gemini-2.0-flash")
    gemini_pro_model: str = os.getenv("GEMINI_PRO_MODEL", "gemini-2.0-pro")
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    groq_flash_model: str = os.getenv("GROQ_FLASH_MODEL", "llama-3.1-8b-instant")
    groq_pro_model: str = os.getenv("GROQ_PRO_MODEL", "llama-3.3-70b-versatile")
    cors_origin: str = os.getenv("CORS_ORIGIN", "http://localhost:5173")
    request_timeout_seconds: float = float(os.getenv("REQUEST_TIMEOUT_SECONDS", "30"))
    request_max_retries: int = int(os.getenv("REQUEST_MAX_RETRIES", "3"))


settings = Settings()
