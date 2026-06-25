"""Shared helper for creating in-app notifications."""
from __future__ import annotations

import uuid
import logging
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification

logger = logging.getLogger(__name__)


async def notify(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    type: str,
    title: str,
    body: str | None = None,
    data: dict | None = None,
) -> None:
    """Create a notification record. Errors are logged, never raised."""
    try:
        notif = Notification(
            user_id=user_id,
            type=type,
            title=title,
            body=body,
            data=data or {},
        )
        db.add(notif)
        # Caller is responsible for commit
    except Exception as exc:
        logger.warning("Failed to create notification: %s", exc)
