"""
Revenue engine package.

Groups the hotel-facing tools whose job is to *increase bookings and revenue*
rather than merely manage the property:

  * pricing_model / pricing_engine / pricing  — hotelier-configured dynamic pricing rules
  * recovery                                  — abandoned-booking WhatsApp + email follow-up

Loyalty (stay offers + points wallet) already lives in `app.loyalty` and is
surfaced together with these under the "Revenue" section in the dashboard.
"""
