# Import all models here so that Base.metadata is populated before create_all()
# and Alembic autogenerate sees every table.
from backend.models.base import Base
from backend.models.project import Project
from backend.models.target import Target
from backend.models.scan import Scan, ScanResult
from backend.models.host import Host
from backend.models.port import Port
from backend.models.finding import Finding, FindingEvidence
from backend.models.credential import Credential
from backend.models.note import Note
from backend.models.proxy_request import ProxyRequest
from backend.models.ai_analysis import AIAnalysis
from backend.models.chain import Chain, ChainRun
from backend.models.plugin import Plugin
from backend.models.license import License

__all__ = [
    "Base",
    "Project",
    "Target",
    "Scan",
    "ScanResult",
    "Host",
    "Port",
    "Finding",
    "FindingEvidence",
    "Credential",
    "Note",
    "ProxyRequest",
    "AIAnalysis",
    "Chain",
    "ChainRun",
    "Plugin",
    "License",
]
