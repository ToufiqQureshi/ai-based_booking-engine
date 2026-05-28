"""
Hotels Router
Hotel profile aur settings management.
Multi-tenant - har user apni hotel hi dekh/edit kar sakta hai.
"""
from app.services.email_service import get_email_service
from fastapi import APIRouter, HTTPException, status
from sqlmodel import select

from app.api.deps import CurrentUser, DbSession
from app.models.hotel import Hotel, HotelRead, HotelUpdate

router = APIRouter(prefix="/hotels", tags=["Hotels"])


@router.get("/me", response_model=HotelRead)
async def get_my_hotel(current_user: CurrentUser, session: DbSession):
    """
    Current user ki hotel get karo.
    Dashboard aur settings page ke liye.
    """
    if not current_user.hotel_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No hotel associated with this user"
        )
    
    result = await session.execute(
        select(Hotel).where(Hotel.id == current_user.hotel_id)
    )
    hotel = result.scalar_one_or_none()
    
    if not hotel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hotel not found"
        )
    
    return hotel


@router.patch("/me", response_model=HotelRead)
async def update_my_hotel(
    hotel_update: HotelUpdate,
    current_user: CurrentUser,
    session: DbSession
):
    """
    Current user ki hotel update karo.
    Settings page se hotel details change karne ke liye.
    """
    if not current_user.hotel_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No hotel associated"
        )
    
    result = await session.execute(
        select(Hotel).where(Hotel.id == current_user.hotel_id)
    )
    hotel = result.scalar_one_or_none()
    
    if not hotel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hotel not found"
        )
    
    # Update only provided fields
    update_data = hotel_update.model_dump(exclude_unset=True)

    if "slug" in update_data and update_data["slug"]:
        new_slug = update_data["slug"].lower().strip()
        if new_slug != hotel.slug:
            # Check uniqueness
            existing = await session.execute(select(Hotel).where(Hotel.slug == new_slug))
            if existing.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This URL Slug is already taken by another hotel property"
                )
            update_data["slug"] = new_slug

    for field, value in update_data.items():
        setattr(hotel, field, value)
    
    from datetime import datetime
    hotel.updated_at = datetime.utcnow()
    
    session.add(hotel)
    await session.commit()
    await session.refresh(hotel)
    
    # Invalidate public caches on settings change (e.g. tax settings update)
    try:
        from app.core.redis_client import redis_client
        redis_client.delete_key(f"public:hotel-details:{hotel.id}")
        redis_client.delete_key(f"public:widget-config:{hotel.id}")
        redis_client.delete_key(f"public:slug-to-id:{hotel.slug}")
        redis_client.delete_key(f"public:slug-to-id:{hotel.id}")
        # Clear rooms and availability cache
        from app.api.v1.availability import clear_availability_cache
        clear_availability_cache(hotel.id)
    except Exception as e:
        pass
    
    return hotel



from pydantic import BaseModel
class TestEmailRequest(BaseModel):
    settings: dict
    test_email: str

@router.post("/{hotel_id}/test-email-connection")
async def test_email_connection(
    hotel_id: str,
    request: TestEmailRequest,
    email_service=Depends(get_email_service)
):
    try:
        from app.services.email_service import EmailService
        
        # Dispatch a test email directly via the existing service flow
        hotel_settings = request.settings
        test_email = request.test_email
        
        # Construct simple test HTML
        html_content = """
        <html>
            <body>
                <h2>Test Connection Successful!</h2>
                <p>If you are reading this, your email settings are working correctly.</p>
            </body>
        </html>
        """
        
        success = await email_service._dispatch_hotel_email(
            hotel_settings=hotel_settings,
            to_emails=[test_email],
            subject="Test Email Connection - StayBooker",
            html_content=html_content
        )
        
        if success:
            return {"status": "success", "message": "Test email sent successfully"}
        else:
            raise HTTPException(status_code=400, detail="Failed to send test email. Check your credentials.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
