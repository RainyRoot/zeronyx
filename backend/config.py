from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="ZERONYX_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    env: str = "development"
    port: int = 8742
    host: str = "127.0.0.1"

    # Data directory where project databases are stored
    data_dir: Path = Path.home() / ".zeronyx"

    # Global app database filename (inside data_dir)
    db_name: str = "app.db"

    @property
    def db_path(self) -> Path:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        return self.data_dir / self.db_name

    @property
    def db_url(self) -> str:
        return f"sqlite:///{self.db_path}"

    @property
    def is_dev(self) -> bool:
        return self.env == "development"


settings = Settings()
