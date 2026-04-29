import asyncio
from app.core.database import engine
from sqlmodel import select
from app.models.hotel import Hotel
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.guest_agent import create_guest_agent_graph
from langchain_core.messages import HumanMessage

async def main():
    async with AsyncSession(engine) as session:
        # Get a hotel slug
        res = await session.execute(select(Hotel).limit(1))
        hotel = res.scalar_one_or_none()
        if not hotel:
            print("No hotels found in DB!")
            return
            
        print(f"Testing for hotel: {hotel.name} (Slug: {hotel.slug})")
        
        # Create agent
        try:
            agent = create_guest_agent_graph(session, hotel.id)
            print("Agent created successfully!")
            
            # Invoke agent
            print("Invoking agent...")
            response = await agent.ainvoke({"messages": [HumanMessage(content="Hello, I am looking for a room")]})
            print("AI Response:")
            print(response["messages"][-1].content)
            
        except Exception as e:
            print(f"Exception caught:")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
