from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class EvidenceItem(BaseModel):
    type: str
    record_id: str
    timestamp: str
    contribution: float

class PersonNode(BaseModel):
    node_id: str
    names: List[str]
    phone: str
    known_addresses: List[str]
    city: str
    bail_status: str = 'none'
    prior_cases: List[str] = []
    role: str = 'contact'
    network_score: Optional[float] = None

class Edge(BaseModel):
    edge_id: str
    source: str
    target: str
    edge_type: str
    risk_score: float = 0.0
    evidence: List[EvidenceItem] = []
    status: str = 'candidate'

class LedgerBlock(BaseModel):
    block_id: int
    action: str
    ref: str
    actor: str = 'system'
    timestamp: str
    prev_hash: str
    hash: str
    details: Optional[str] = None

class RiskQueueItem(BaseModel):
    edge_id: str
    source: str
    target: str
    source_names: List[str]
    target_names: List[str]
    risk_score: float
    evidence: List[EvidenceItem]
    status: str

class CommunityResult(BaseModel):
    community_id: int
    members: List[str]
    member_names: List[dict]

class CentralityResult(BaseModel):
    node_id: str
    pagerank: float
    betweenness: float

class TimelineEvent(BaseModel):
    event_type: str
    timestamp: str
    description: str
    related_person: Optional[str] = None
    record_id: str
