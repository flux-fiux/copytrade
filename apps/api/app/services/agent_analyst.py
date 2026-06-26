"""TradingAgents (Tauric Research, Apache-2.0) multi-agent analysis wrapper.

Runs a panel of LLM agents (market / sentiment / news / fundamentals analysts →
bull/bear researcher debate → trader → risk team) and returns a BUY/SELL/HOLD
decision plus each agent's report. Powered by DeepSeek (cost-efficient for the
high token volume of multi-agent debate).

Heavy + slow: call from a Celery task, never inside a request.
"""
import os
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

# Curated TradingAgents state keys → our report buckets (best-effort; the graph
# evolves, so we also capture any other string-valued state below).
_REPORT_KEYS = {
    "market_report": "market",
    "sentiment_report": "sentiment",
    "news_report": "news",
    "fundamentals_report": "fundamentals",
    "investment_plan": "research_plan",
    "trader_investment_plan": "trader_plan",
    "final_trade_decision": "final_decision",
}


def is_available() -> tuple[bool, str]:
    """Whether the agent core is configured. Checked from the API process for
    gating/UX, so it only verifies the LLM key — the heavy `tradingagents` dep
    lives in the dedicated agent-worker, where run_analysis imports it for real.
    """
    if not settings.DEEPSEEK_API_KEY:
        return False, "DEEPSEEK_API_KEY not configured"
    return True, ""


def _flatten_debate(state: dict, key: str) -> str | None:
    """Debate sub-states are dicts (bull/bear/risk histories + judge decision)."""
    d = state.get(key)
    if isinstance(d, dict):
        parts = [f"{k}:\n{v}" for k, v in d.items() if isinstance(v, str) and v.strip()]
        return "\n\n".join(parts) or None
    return d if isinstance(d, str) else None


def run_analysis(symbol: str, trade_date: str, asset_type: str = "stock") -> dict:
    """Run the multi-agent graph. Returns {decision, reports}. Raises on failure."""
    ok, reason = is_available()
    if not ok:
        raise RuntimeError(reason)

    # TradingAgents reads keys from the environment.
    os.environ["DEEPSEEK_API_KEY"] = settings.DEEPSEEK_API_KEY
    if settings.ALPHA_VANTAGE_API_KEY:
        os.environ["ALPHA_VANTAGE_API_KEY"] = settings.ALPHA_VANTAGE_API_KEY

    from tradingagents.graph.trading_graph import TradingAgentsGraph
    from tradingagents.default_config import DEFAULT_CONFIG

    config = DEFAULT_CONFIG.copy()
    config["llm_provider"] = "deepseek"
    config["deep_think_llm"] = settings.AGENT_DEEP_MODEL
    config["quick_think_llm"] = settings.AGENT_QUICK_MODEL
    config["max_debate_rounds"] = settings.AGENT_MAX_DEBATE_ROUNDS
    config["online_tools"] = True
    config["results_dir"] = "/tmp/tradingagents_results"
    # Use yfinance (free, keyless) for all core data so no market-data key is
    # required. Optional macro/prediction vendors degrade gracefully if unset.
    config["data_vendors"] = {
        "core_stock_apis": "yfinance",
        "technical_indicators": "yfinance",
        "fundamental_data": "yfinance",
        "news_data": "yfinance",
    }

    analysts = tuple(a.strip() for a in settings.AGENT_ANALYSTS.split(",") if a.strip()) \
        or ("market", "social", "news", "fundamentals")

    logger.info("Running TradingAgents for %s (%s) on %s — analysts=%s", symbol, asset_type, trade_date, analysts)
    ta = TradingAgentsGraph(config=config, selected_analysts=analysts)
    state, decision = ta.propagate(symbol, trade_date, asset_type=asset_type)

    reports: dict[str, str] = {}
    if isinstance(state, dict):
        for src, dst in _REPORT_KEYS.items():
            v = state.get(src)
            if isinstance(v, str) and v.strip():
                reports[dst] = v
        for src, dst in (("investment_debate_state", "research_debate"),
                         ("risk_debate_state", "risk_debate")):
            flat = _flatten_debate(state, src)
            if flat:
                reports[dst] = flat

    # Normalize the decision to BUY/SELL/HOLD.
    raw = str(decision or "").upper()
    norm = next((w for w in ("BUY", "SELL", "HOLD") if w in raw), None)

    return {"decision": norm or raw[:16] or None, "reports": reports, "raw_decision": str(decision or "")}
