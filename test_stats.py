import asyncio
from datetime import date, timedelta, datetime
from app.core.database import get_session, async_session
from app.models.booking import Booking, BookingStatus
from sqlmodel import select, func

async def check():
    h_id = "3815e471-5d06-4993-99be-00ff4ae88d05"
    today = date.today()
    yesterday = today - timedelta(days=1)
    start_of_day = datetime.combine(today, datetime.min.time())
    start_of_yest = start_of_day - timedelta(days=1)

    try:
        async with async_session() as session:
            stats_query = select(
                func.count(Booking.id).filter(
                    Booking.check_in == today,
                    Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING])
                ).label('arrivals_today'),

                func.count(Booking.id).filter(
                    Booking.check_out == today,
                    Booking.status == BookingStatus.CHECKED_IN
                ).label('departures_today'),

                func.count(Booking.id).filter(
                    Booking.status == BookingStatus.CHECKED_IN
                ).label('occupancy_today'),

                func.sum(Booking.total_amount).filter(
                    Booking.created_at >= start_of_day
                ).label('revenue_today'),

                func.count(Booking.id).filter(
                    Booking.check_in == yesterday,
                    Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING])
                ).label('arrivals_yest'),

                func.count(Booking.id).filter(
                    Booking.status == BookingStatus.CHECKED_IN,
                    Booking.updated_at < start_of_day
                ).label('occupancy_yest'),

                func.sum(Booking.total_amount).filter(
                    Booking.created_at >= start_of_yest,
                    Booking.created_at < start_of_day
                ).label('revenue_yest'),

                func.count(Booking.id).filter(
                    Booking.status == BookingStatus.PENDING
                ).label('pending_bookings')
            ).where(Booking.hotel_id == h_id)

            stats_res = await session.execute(stats_query)
            stats = stats_res.one()
            print("Stats query succeeded:", stats)
    except Exception as e:
        print("ERROR IN STATS QUERY:", type(e).__name__, str(e))

asyncio.run(check())
