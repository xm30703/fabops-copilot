from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[1]

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / '.env', extra='ignore')
    domain_api: str = 'http://127.0.0.1:5080'
    service_key: str = 'local-service-change-me'
    operator_key: str = 'local-operator-change-me'
    ai_provider: str = 'ollama'
    ollama_url: str = 'http://127.0.0.1:11434'
    ollama_chat_model: str = 'qwen2.5:7b'
    ollama_embed_model: str = 'nomic-embed-text'
    otel_exporter_otlp_endpoint: str = 'http://127.0.0.1:4318'
    agent_port: int = 4317
    jaeger_ui_url: str = 'http://127.0.0.1:16686'

settings = Settings()
