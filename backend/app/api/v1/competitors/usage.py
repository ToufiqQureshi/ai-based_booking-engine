"""
ScrapingBee API usage endpoint — cost transparency for hoteliers.
We buy scraping capacity from ScrapingBee and surface it as the OTA Analytics /
Rate Shopper feature, so the hotelier can see exactly how much is being used.
"""
from fastapi import APIRouter, Depends

from app.api.deps import CurrentUser
from app.core.feature_flags import require_feature
from app.core.scrapingbee_usage import get_usage_summary

from .crud import check_rate_shopper_feature

router = APIRouter(prefix="/competitors", tags=["Competitor Rates"])


@router.get("/usage", dependencies=[Depends(require_feature("feature_rate_shopper"))])
async def get_scrapingbee_usage(current_user: CurrentUser):
    """Today's and last-30-days ScrapingBee API request counts for this hotel."""
    check_rate_shopper_feature(current_user)
    return get_usage_summary(current_user.hotel_id)
