import os

new_endpoint = """

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
        html_content = \"\"\"
        <html>
            <body>
                <h2>Test Connection Successful!</h2>
                <p>If you are reading this, your email settings are working correctly.</p>
            </body>
        </html>
        \"\"\"
        
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
"""

with open('backend/app/api/v1/hotels.py', 'a', encoding='utf-8') as f:
    f.write(new_endpoint)
