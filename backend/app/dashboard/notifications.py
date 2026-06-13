from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import select, desc
from app.core.deps import DbSession, get_current_user
from app.guests.user import User
from app.dashboard.notification import Notification

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("", response_model=List[Notification])
async def get_notifications(
    session: DbSession,
    current_user: User = Depends(get_current_user),
    limit: int = Query(10, ge=1, le=50),
    offset: int = Query(0, ge=0)
):
    """
    Get user notifications, ordered by newest first.
    """
    statement = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(desc(Notification.created_at))
        .offset(offset)
        .limit(limit)
    )
    result = await session.execute(statement)
    return result.scalars().all()

@router.patch("/{notification_id}/read", response_model=Notification)
async def mark_notification_read(
    notification_id: str,
    session: DbSession,
    current_user: User = Depends(get_current_user)
):
    """
    Mark a notification as read.
    """
    notification = await session.get(Notification, notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    if notification.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    notification.is_read = True
    session.add(notification)
    await session.commit()
    await session.refresh(notification)
    return notification

@router.post("/read-all", response_model=dict)
async def mark_all_read(
    session: DbSession,
    current_user: User = Depends(get_current_user)
):
    """
    Mark all unread notifications as read for current user.
    """
    statement = select(Notification).where(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    )
    result = await session.execute(statement)
    notifications = result.scalars().all()
    
    for notification in notifications:
        notification.is_read = True
        session.add(notification)
        
    await session.commit()
    return {"message": f"Marked {len(notifications)} notifications as read"}

