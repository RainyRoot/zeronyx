# Import all models here so that Base.metadata is populated before create_all()
from backend.models.base import Base
from backend.models.project import Project

__all__ = ["Base", "Project"]
