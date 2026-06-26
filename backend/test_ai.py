import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.core.config import settings
from app.brand_console.hotel import Hotel
from app.integration.integration import IntegrationSettings

async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        result = await session.execute(select(Hotel).limit(1))
        hotel = result.scalar_one_or_none()
        if not hotel:
            print("No hotel")
            return
        
        int_res = await session.execute(select(IntegrationSettings).where(IntegrationSettings.hotel_id == hotel.id))
        int_settings = int_res.scalar_one_or_none()
        
        print(f"Hotel: {hotel.name}")
        print(f"Hotel AI Provider: {hotel.ai_provider}, AI Model: {hotel.ai_model}, AI Key: {hotel.ai_api_key}, Vault: {getattr(hotel, 'ai_api_key_vault_id', None)}")
        if int_settings:
            print(f"IntSettings AI Provider: {int_settings.ai_provider}, AI Model: {int_settings.ai_model}, AI Key: {int_settings.ai_api_key}, Vault: {getattr(int_settings, 'ai_api_key_vault_id', None)}")
        else:
            print("No IntSettings")

        print(f"Settings: {hotel.settings}")

asyncio.run(main())
