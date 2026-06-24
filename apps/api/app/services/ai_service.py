"""AI service — supports DeepSeek (default) and Anthropic Claude.

DeepSeek uses the OpenAI-compatible API, so we use the openai package for both.
Provider is selected by AI_PROVIDER env var; falls back to mock when no key is set.
"""
from __future__ import annotations

import json
from app.core.config import settings


def _is_available() -> bool:
    if settings.AI_PROVIDER == "anthropic":
        return bool(settings.ANTHROPIC_API_KEY)
    return bool(settings.DEEPSEEK_API_KEY)


def _chat(messages: list[dict], max_tokens: int = 1024) -> str:
    """Unified chat call — routes to DeepSeek or Anthropic based on config."""
    if settings.AI_PROVIDER == "anthropic":
        import anthropic
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        # Anthropic separates system from user messages
        system_msgs = [m["content"] for m in messages if m["role"] == "system"]
        user_msgs = [m for m in messages if m["role"] != "system"]
        resp = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=max_tokens,
            system=system_msgs[0] if system_msgs else "You are a helpful assistant.",
            messages=user_msgs,
        )
        return resp.content[0].text

    # DeepSeek — OpenAI-compatible
    from openai import OpenAI
    client = OpenAI(
        api_key=settings.DEEPSEEK_API_KEY,
        base_url="https://api.deepseek.com",
    )
    resp = client.chat.completions.create(
        model=settings.DEEPSEEK_MODEL,
        messages=messages,
        max_tokens=max_tokens,
        temperature=0.7,
    )
    return resp.choices[0].message.content or ""


async def explain_master(trade_history: list[dict], lang: str = "en") -> str:
    """
    用 AI 解读 Master 的交易风格，帮助 Follower 做决策。
    trade_history: 最近 N 笔交易记录 [{ symbol, direction, profit, volume, opened_at, closed_at }]
    lang: 输出语言 (en | zh-CN | ja | es)
    """
    if not _is_available():
        return _mock_explain(trade_history, lang)

    lang_instruction = {
        "zh-CN": "请用简体中文回答。",
        "ja": "日本語で回答してください。",
        "es": "Por favor responde en español.",
    }.get(lang, "Please respond in English.")

    trades_json = json.dumps(trade_history[:50], ensure_ascii=False, default=str)

    messages = [
        {
            "role": "system",
            "content": (
                "You are a professional trading analyst specializing in forex and CFD markets. "
                "Analyze trader performance data and provide clear, concise insights for potential followers. "
                "Be objective, highlight both strengths and risks. "
                f"{lang_instruction}"
            ),
        },
        {
            "role": "user",
            "content": (
                f"Analyze this trader's recent trade history and provide a brief strategy overview:\n\n"
                f"{trades_json}\n\n"
                "Cover in 3-4 short paragraphs:\n"
                "1. Trading style (scalper/swing/positional, preferred pairs/assets)\n"
                "2. Risk management approach (position sizing, stop-loss discipline)\n"
                "3. Key strengths and potential risks for followers\n"
                "4. Who this trader is best suited for (risk appetite, account size)\n"
                "Keep it under 200 words, no markdown headers."
            ),
        },
    ]

    try:
        return _chat(messages, max_tokens=512)
    except Exception as e:
        return _mock_explain(trade_history, lang)


async def analyze_signal(signal: dict, lang: str = "en") -> str:
    """解读单个交易信号的逻辑（为什么开仓、风险收益比等）。"""
    if not _is_available():
        return ""

    lang_instruction = {
        "zh-CN": "请用简体中文回答。",
        "ja": "日本語で回答してください。",
        "es": "Por favor responde en español.",
    }.get(lang, "")

    messages = [
        {
            "role": "system",
            "content": f"You are a forex analyst. Briefly explain this trade signal in 2-3 sentences. {lang_instruction}",
        },
        {
            "role": "user",
            "content": (
                f"Signal: {signal.get('direction')} {signal.get('symbol')} "
                f"at {signal.get('open_price')}, "
                f"SL: {signal.get('stop_loss')}, TP: {signal.get('take_profit')}. "
                "What's the likely rationale and risk/reward?"
            ),
        },
    ]

    try:
        return _chat(messages, max_tokens=150)
    except Exception:
        return ""


def _mock_explain(trade_history: list[dict], lang: str) -> str:
    count = len(trade_history)
    wins = sum(1 for t in trade_history if (t.get("profit") or 0) > 0)
    win_rate = round(wins / count * 100) if count else 0

    if lang == "zh-CN":
        return (
            f"该交易者近期共记录 {count} 笔交易，胜率约 {win_rate}%。"
            "交易风格偏向短中线，主要交易外汇主要货币对。"
            "风险控制较为稳健，每笔交易设有明确止损。"
            "适合中等风险偏好、有一定外汇基础的跟单者。"
            "（AI 分析需配置 DEEPSEEK_API_KEY 或 ANTHROPIC_API_KEY）"
        )
    return (
        f"This trader has {count} recent trades with a ~{win_rate}% win rate. "
        "Their style leans toward short-to-medium term forex trading. "
        "Risk management appears disciplined with consistent stop-loss usage. "
        "Best suited for moderate-risk followers with basic forex knowledge. "
        "(Configure DEEPSEEK_API_KEY or ANTHROPIC_API_KEY for real AI analysis)"
    )
