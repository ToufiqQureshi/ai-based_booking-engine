import asyncio
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ["DATABASE_URL"] = "postgresql+asyncpg://postgres.iupgzyilraahuwqnkgqq:Staybooker_2026@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"

from fastapi import Request
from app.core.database import async_session
from app.api.v1.integration import whatsapp_webhook_receive

class MockRequest:
    def __init__(self, json_data):
        self._json = json_data

    async def json(self):
        return self._json

async def main():
    print("--- Simulating Meta Webhook Payload ---")
    
    # This matches the exact JSON structure Meta sends
    payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "1608170620286033",
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {
                                "display_phone_number": "1234567890",
                                "phone_number_id": "1148611098333430"
                            },
                            "contacts": [
                                {
                                    "profile": {"name": "Test User"},
                                    "wa_id": "919665458841"
                                }
                            ],
                            "messages": [
                                {
                                    "from": "919665458841",
                                    "id": "wamid.HBgLOTE5",
                                    "timestamp": "1700000000",
                                    "text": {"body": "Hi, I am testing the webhook with new token"},
                                    "type": "text"
                                }
                            ]
                        },
                        "field": "messages"
                    }
                ]
            }
        ]
    }
    
    request = MockRequest(payload)
    
    async with async_session() as session:
        # First update the hotel token in the DB
        from app.models.hotel import Hotel
        from sqlmodel import select
        
        print("Updating WhatsApp API Key in database...")
        stmt = select(Hotel)
        res = await session.execute(stmt)
        for h in res.scalars().all():
            h_settings = h.settings or {}
            if str(h_settings.get("whatsapp_phone_number_id")) == "1148611098333430":
                h_settings["whatsapp_api_key"] = "EAAOoDsMZAD2kBRmXCa6dt1SM3DQVivEVifXaSNQBAt8Y8BoJXTbHhXUZCNnH4jCZB7w27IOMRTDNZCiXSrZBFYA4x36YP7iJn07YBPBDrg4rwEtZCIfgM4MqMw6y3YSPe2w6ooE1XzsZBXegAsPwtZBVenZCPtTbZBETbZBiUbMXX7C5J5GjD9topLlA9jdpcUCnssE2faMSQoTkuFhxn1KezXNZCDZBGgzZAWZATGW8YmUH116zPV8LbLK6Peijk4iSjnt2U8GdT7cYkHi3ncLJiohVXVSyjy7"
                # Need to update column
                import sqlalchemy
                stmt_update = sqlalchemy.update(Hotel).where(Hotel.id == h.id).values(settings=h_settings)
                await session.execute(stmt_update)
                await session.commit()
                print(f"Token updated for hotel {h.name}!")
                break
                
        print("Triggering whatsapp_webhook_receive...")
        try:
            response = await whatsapp_webhook_receive(request, session)
            print(f"Webhook Execution Completed. Result: {response}")
        except Exception as e:
            print(f"ERROR inside webhook: {e}")

if __name__ == "__main__":
    asyncio.run(main())
