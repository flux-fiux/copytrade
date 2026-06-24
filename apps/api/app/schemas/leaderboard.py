import uuid
from pydantic import BaseModel


class LeaderboardEntry(BaseModel):
    rank: int
    master_id: str
    username: str
    return_pct: float
    max_drawdown: float
    sharpe_ratio: float
    win_rate: float
    followers_count: int
    risk_grade: str
    trading_days: int
    period: str


class LeaderboardResponse(BaseModel):
    entries: list[LeaderboardEntry]
    total: int
    period: str
