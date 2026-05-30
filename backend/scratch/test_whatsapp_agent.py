import asyncio
import os
import sys

# Add backend directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Set environment variable to make sure configuration is loaded
os.environ["DATABASE_URL"] = "postgresql+asyncpg://postgres.iupgzyilraahuwqnkgqq:Staybooker_2026@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"

from sqlmodel import select
from app.core.database import async_session
from app.models.hotel import Hotel
from app.models.integration import IntegrationSettings
from app.models.subscription import Subscription
from app.core.guest_agent import create_guest_agent_graph
from langchain_core.messages import HumanMessage

async def main():
    phone_number_id = "1148611098333430"
    print(f"--- Starting test for WhatsApp Phone Number ID: {phone_number_id} ---")
    
    async with async_session() as session:
        # 1. Fetch all hotels to find the target hotel
        print("1. Fetching hotels from database...")
        hotel_stmt = select(Hotel)
        hotel_res = await session.execute(hotel_stmt)
        hotels = hotel_res.scalars().all()
        
        target_hotel = None
        for h in hotels:
            h_settings = h.settings or {}
            # Print available settings for debugging
            if h_settings.get("whatsapp_phone_number_id"):
                print(f"Found hotel '{h.name}' with WhatsApp Phone Number ID: {h_settings.get('whatsapp_phone_number_id')}")
            if str(h_settings.get("whatsapp_phone_number_id")) == phone_number_id:
                target_hotel = h
                break
                
        if not target_hotel:
            print("ERROR: No hotel found with the specified WhatsApp Phone Number ID!")
            return
            
        print(f"\nTarget Hotel found: {target_hotel.name} (ID: {target_hotel.id})")
        print(f"Feature AI Agent flag: {target_hotel.feature_ai_agent}")
        
        # 2. Check Subscription
        print("\n2. Checking Subscription...")
        sub_stmt = select(Subscription).where(Subscription.hotel_id == target_hotel.id, Subscription.status == "active")
        sub_res = await session.execute(sub_stmt)
        subscription = sub_res.scalar_one_or_none()
        
        if not subscription:
            print("WARNING: No active subscription found for this hotel!")
        else:
            print(f"Subscription active. Remaining WhatsApp Credits: {subscription.whatsapp_credits}")
            
        # 3. Load Integration Settings
        print("\n3. Loading Integration Settings...")
        int_stmt = select(IntegrationSettings).where(IntegrationSettings.hotel_id == target_hotel.id)
        int_res = await session.execute(int_stmt)
        int_settings = int_res.scalar_one_or_none()
        
        if not int_settings:
            print("ERROR: Integration settings not found for this hotel!")
            return
            
        print(f"AI Provider: {int_settings.ai_provider}")
        print(f"AI Model: {int_settings.ai_model}")
        print(f"AI Base URL: {int_settings.ai_base_url}")
        print(f"Has AI API Key: {'Yes' if int_settings.ai_api_key else 'No'}")
        
        if not int_settings.ai_api_key:
            print("ERROR: AI API Key is missing!")
            return
            
        # 4. Try initializing the AI agent graph
        print("\n4. Initializing AI Agent Graph...")
        try:
            agent = create_guest_agent_graph(
                session,
                target_hotel.id,
                int_settings.ai_provider,
                int_settings.ai_api_key,
                int_settings.ai_model,
                int_settings.ai_base_url,
                target_hotel.name
            )
            
            if not agent:
                print("ERROR: Agent graph initialization returned None!")
                return
                
            print("Agent Graph initialized successfully!")
            
            # 5. Run test message
            print("\n5. Testing AI reply with simple prompt: 'Hi, what rooms do you have?'")
            test_prompt = "Hi, what rooms do you have?"
            input_messages = [HumanMessage(content=test_prompt)]
            
            result = await agent.ainvoke({"messages": input_messages})
            agent_reply = result["messages"][-1].content
            print(f"\nAI Agent Replied:\n{agent_reply}")
            
        except Exception as e:
            print(f"CRITICAL ERROR during agent testing: {e}")

if __name__ == "__main__":
    asyncio.run(main())
