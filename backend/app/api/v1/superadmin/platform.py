"""
Super Admin — Platform settings: API keys, custom domains, email templates,
sub-roles, and bulk invoice generation.
"""
import hashlib
import logging
import secrets
import string
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import select, func

from app.api.deps import DbSession
from app.models.audit import AuditLog
from app.models.commission import PlatformInvoice
from app.models.hotel import Hotel
from app.models.platform import (
    HotelierApiKey, CustomDomain, EmailTemplate, SuperAdminRole,
    DEFAULT_PERMISSIONS_BY_TIER,
)
from app.models.subscription import Subscription
from app.models.user import User, UserRole
from .hotels import get_super_admin, _get_client_ip, require_permission

logger = logging.getLogger(__name__)
router = APIRouter()


# ──────────────── API Keys ────────────────

def _generate_api_key() -> tuple[str, str, str]:
    """Returns (raw_key, prefix, hash)."""
    raw = "sb_" + "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(40))
    prefix = raw[:11]
    key_hash = hashlib.sha256(raw.encode()).hexdigest()
    return raw, prefix, key_hash


@router.get("/api-keys")
async def list_api_keys(
    session: DbSession,
    hotel_id: Optional[str] = None,
    super_admin: User = Depends(require_permission("superadmin.platform.read")),
):
    q = select(HotelierApiKey)
    if hotel_id:
        q = q.where(HotelierApiKey.hotel_id == hotel_id)
    q = q.order_by(HotelierApiKey.created_at.desc())
    return (await session.execute(q)).scalars().all()


@router.post("/api-keys")
async def create_api_key(
    data: dict, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.platform.read")),
):
    if not data.get("hotel_id") or not data.get("label"):
        raise HTTPException(400, "hotel_id and label are required")
    raw, prefix, key_hash = _generate_api_key()
    expires_at = None
    if data.get("expires_in_days"):
        expires_at = datetime.utcnow() + timedelta(days=int(data["expires_in_days"]))
    key = HotelierApiKey(
        hotel_id=data["hotel_id"],
        label=data["label"],
        key_prefix=prefix,
        key_hash=key_hash,
        scopes=data.get("scopes", ["read"]),
        expires_at=expires_at,
        created_by=super_admin.id,
    )
    session.add(key)
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=key.hotel_id,
        action="API_KEY_CREATE",
        description=f"Created API key '{key.label}' ({prefix}…)",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    await session.refresh(key)
    return {**key.model_dump(), "raw_key": raw, "warning": "Save this key now — it cannot be retrieved later."}


@router.post("/api-keys/{key_id}/revoke")
async def revoke_api_key(
    key_id: str, data: dict, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.platform.read")),
):
    key = await session.get(HotelierApiKey, key_id)
    if not key:
        raise HTTPException(404, "Key not found")
    key.is_active = False
    key.revoked_at = datetime.utcnow()
    key.revoked_reason = data.get("reason", "Revoked by admin")
    session.add(key)
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=key.hotel_id,
        action="API_KEY_REVOKE",
        description=f"Revoked API key {key.key_prefix}… — {key.revoked_reason}",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    return key


@router.delete("/api-keys/{key_id}")
async def delete_api_key(
    key_id: str, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.platform.read")),
):
    key = await session.get(HotelierApiKey, key_id)
    if not key:
        raise HTTPException(404, "Key not found")
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=key.hotel_id,
        action="API_KEY_DELETE",
        description=f"Deleted API key {key.key_prefix}…",
        ip_address=_get_client_ip(request),
    ))
    await session.delete(key)
    await session.commit()
    return {"message": "Deleted"}


# ──────────────── Custom Domains ────────────────

@router.get("/domains")
async def list_domains(
    session: DbSession,
    hotel_id: Optional[str] = None,
    super_admin: User = Depends(require_permission("superadmin.platform.read")),
):
    q = select(CustomDomain)
    if hotel_id:
        q = q.where(CustomDomain.hotel_id == hotel_id)
    q = q.order_by(CustomDomain.created_at.desc())
    return (await session.execute(q)).scalars().all()


@router.post("/domains")
async def create_domain(
    data: dict, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.platform.read")),
):
    if not data.get("hotel_id") or not data.get("domain"):
        raise HTTPException(400, "hotel_id and domain required")
    existing = (await session.execute(
        select(CustomDomain).where(CustomDomain.domain == data["domain"])
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(400, "Domain already mapped")
    verification_token = secrets.token_hex(16)
    dns_records = [
        {"type": "CNAME", "host": data["domain"], "value": "proxy.staybooker.com", "purpose": "Routing"},
        {"type": "TXT", "host": f"_staybooker.{data['domain']}", "value": verification_token, "purpose": "Verification"},
    ]
    dom = CustomDomain(
        hotel_id=data["hotel_id"],
        domain=data["domain"].strip().lower(),
        verification_token=verification_token,
        dns_records=dns_records,
        is_primary=bool(data.get("is_primary", True)),
    )
    session.add(dom)
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=dom.hotel_id,
        action="DOMAIN_CREATE",
        description=f"Mapped domain {dom.domain}",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    await session.refresh(dom)
    return dom


@router.post("/domains/{domain_id}/verify")
async def verify_domain(
    domain_id: str, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.platform.read")),
):
    dom = await session.get(CustomDomain, domain_id)
    if not dom:
        raise HTTPException(404, "Domain not found")
    dom.is_verified = True
    dom.verified_at = datetime.utcnow()
    dom.ssl_status = "active"
    dom.ssl_issued_at = datetime.utcnow()
    dom.ssl_expires_at = datetime.utcnow() + timedelta(days=90)
    dom.updated_at = datetime.utcnow()
    session.add(dom)
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=dom.hotel_id,
        action="DOMAIN_VERIFY",
        description=f"Verified domain {dom.domain}",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    return dom


@router.delete("/domains/{domain_id}")
async def delete_domain(
    domain_id: str, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.platform.read")),
):
    dom = await session.get(CustomDomain, domain_id)
    if not dom:
        raise HTTPException(404, "Domain not found")
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=dom.hotel_id,
        action="DOMAIN_DELETE",
        description=f"Removed domain {dom.domain}",
        ip_address=_get_client_ip(request),
    ))
    await session.delete(dom)
    await session.commit()
    return {"message": "Deleted"}


# ──────────────── Email Templates ────────────────

@router.get("/email-templates")
async def list_templates(
    session: DbSession,
    hotel_id: Optional[str] = None,
    super_admin: User = Depends(require_permission("superadmin.platform.read")),
):
    q = select(EmailTemplate)
    if hotel_id:
        q = q.where((EmailTemplate.hotel_id == hotel_id) | (EmailTemplate.hotel_id.is_(None)))
    q = q.order_by(EmailTemplate.template_key.asc(), EmailTemplate.updated_at.desc())
    return (await session.execute(q)).scalars().all()


@router.post("/email-templates")
async def upsert_template(
    data: dict, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.platform.read")),
):
    tmpl_id = data.get("id")
    tmpl = await session.get(EmailTemplate, tmpl_id) if tmpl_id else None
    if tmpl is None:
        if not data.get("template_key") or not data.get("name"):
            raise HTTPException(400, "template_key and name required")
        tmpl = EmailTemplate(
            template_key=data["template_key"],
            name=data["name"],
        )
    for k in ("hotel_id", "template_key", "name", "channel", "subject",
              "body_html", "body_text", "variables", "is_active", "is_default"):
        if k in data:
            setattr(tmpl, k, data[k])
    tmpl.updated_at = datetime.utcnow()
    session.add(tmpl)
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=tmpl.hotel_id,
        action="EMAIL_TEMPLATE_UPSERT",
        description=f"{'Updated' if tmpl_id else 'Created'} template {tmpl.template_key}",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    await session.refresh(tmpl)
    return tmpl


@router.delete("/email-templates/{tmpl_id}")
async def delete_template(
    tmpl_id: str, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.platform.read")),
):
    tmpl = await session.get(EmailTemplate, tmpl_id)
    if not tmpl:
        raise HTTPException(404, "Template not found")
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=tmpl.hotel_id,
        action="EMAIL_TEMPLATE_DELETE",
        description=f"Deleted template {tmpl.template_key}",
        ip_address=_get_client_ip(request),
    ))
    await session.delete(tmpl)
    await session.commit()
    return {"message": "Deleted"}


# ──────────────── Super Admin Sub-Roles ────────────────

@router.get("/admin-roles")
async def list_admin_roles(
    session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.platform.read")),
):
    rows = (await session.execute(select(SuperAdminRole).order_by(SuperAdminRole.created_at.desc()))).scalars().all()
    return rows


@router.get("/admin-roles/tiers")
async def list_role_tiers(
    super_admin: User = Depends(require_permission("superadmin.platform.read")),
):
    return [
        {"tier": tier, "permissions": perms}
        for tier, perms in DEFAULT_PERMISSIONS_BY_TIER.items()
    ]


@router.post("/admin-roles")
async def upsert_admin_role(
    data: dict, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.platform.read")),
):
    if not data.get("user_id"):
        raise HTTPException(400, "user_id required")
    user = await session.get(User, data["user_id"])
    if not user:
        raise HTTPException(404, "User not found")
    if user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(400, "Target user must be a SUPER_ADMIN")

    existing = (await session.execute(
        select(SuperAdminRole).where(SuperAdminRole.user_id == data["user_id"])
    )).scalar_one_or_none()

    tier = data.get("role_tier", "support")
    perms = data.get("permissions") or DEFAULT_PERMISSIONS_BY_TIER.get(tier, [])
    if existing:
        existing.role_tier = tier
        existing.permissions = perms
        existing.is_active = data.get("is_active", True)
        existing.updated_at = datetime.utcnow()
        role = existing
    else:
        role = SuperAdminRole(
            user_id=user.id, user_email=user.email,
            role_tier=tier, permissions=perms,
            created_by=super_admin.id,
        )
    session.add(role)
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email,
        action="ADMIN_ROLE_UPSERT",
        description=f"Set {user.email} to tier '{tier}' with {len(perms)} permissions",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    await session.refresh(role)
    return role


@router.delete("/admin-roles/{role_id}")
async def delete_admin_role(
    role_id: str, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.platform.read")),
):
    role = await session.get(SuperAdminRole, role_id)
    if not role:
        raise HTTPException(404, "Role not found")
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email,
        action="ADMIN_ROLE_DELETE",
        description=f"Removed sub-role for {role.user_email}",
        ip_address=_get_client_ip(request),
    ))
    await session.delete(role)
    await session.commit()
    return {"message": "Deleted"}


# ──────────────── Platform Invoices (bulk gen) ────────────────

async def _next_invoice_number(session) -> str:
    count = (await session.execute(select(func.count(PlatformInvoice.id)))).scalar() or 0
    year = datetime.utcnow().year
    return f"INV-{year}-{(count + 1):06d}"


@router.get("/invoices")
async def list_invoices(
    session: DbSession,
    hotel_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    limit: int = 100,
    super_admin: User = Depends(require_permission("superadmin.invoices.read")),
):
    q = select(PlatformInvoice)
    if hotel_id:
        q = q.where(PlatformInvoice.hotel_id == hotel_id)
    if status_filter:
        q = q.where(PlatformInvoice.status == status_filter)
    q = q.order_by(PlatformInvoice.issue_date.desc()).limit(limit)
    return (await session.execute(q)).scalars().all()


@router.post("/invoices/bulk-generate")
async def bulk_generate_invoices(
    data: dict, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.invoices.read")),
):
    """Generate subscription invoices for all active hotels for a billing period."""
    plan_filter = data.get("plan_name")
    period_start = datetime.fromisoformat(data["period_start"])
    period_end = datetime.fromisoformat(data["period_end"])
    gst_rate = float(data.get("gst_rate", 18))

    subs_query = select(Subscription, Hotel).join(Hotel, Hotel.id == Subscription.hotel_id).where(
        Subscription.status == "active"
    )
    if plan_filter:
        subs_query = subs_query.where(Subscription.plan_name == plan_filter)
    rows = (await session.execute(subs_query)).all()

    created = []
    for sub, hotel in rows:
        subtotal = float(sub.amount or 0)
        if subtotal <= 0:
            continue
        gst = subtotal * gst_rate / 100
        total = subtotal + gst
        invoice = PlatformInvoice(
            hotel_id=hotel.id,
            invoice_number=await _next_invoice_number(session),
            invoice_type="subscription",
            period_start=period_start, period_end=period_end,
            due_date=datetime.utcnow() + timedelta(days=15),
            subtotal=subtotal, gst_amount=gst, total_amount=total,
            status="issued",
            line_items=[{
                "description": f"{sub.plan_name} subscription ({period_start.date()} → {period_end.date()})",
                "amount": subtotal,
            }],
        )
        session.add(invoice)
        await session.flush()
        created.append(invoice.invoice_number)

    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email,
        action="INVOICE_BULK_GENERATE",
        description=f"Bulk-generated {len(created)} invoices for {period_start.date()} → {period_end.date()}",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    return {"created": len(created), "invoice_numbers": created}


@router.post("/invoices/{invoice_id}/mark-paid")
async def mark_invoice_paid(
    invoice_id: str, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.invoices.read")),
):
    inv = await session.get(PlatformInvoice, invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    inv.status = "paid"
    inv.paid_at = datetime.utcnow()
    inv.updated_at = datetime.utcnow()
    session.add(inv)
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=inv.hotel_id,
        action="INVOICE_MARK_PAID",
        description=f"Marked invoice {inv.invoice_number} as paid",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    return inv


@router.delete("/invoices/{invoice_id}")
async def delete_invoice(
    invoice_id: str, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.invoices.read")),
):
    inv = await session.get(PlatformInvoice, invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    if inv.status == "paid":
        raise HTTPException(400, "Cannot delete a paid invoice — use void status instead")
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=inv.hotel_id,
        action="INVOICE_DELETE",
        description=f"Deleted invoice {inv.invoice_number}",
        ip_address=_get_client_ip(request),
    ))
    await session.delete(inv)
    await session.commit()
    return {"message": "Deleted"}


# ──────────────── Auto-renew toggle on subscription ────────────────

@router.post("/subscriptions/{hotel_id}/auto-renew")
async def toggle_auto_renew(
    hotel_id: str, data: dict, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.platform.read")),
):
    sub = (await session.execute(
        select(Subscription).where(Subscription.hotel_id == hotel_id)
    )).scalar_one_or_none()
    if not sub:
        raise HTTPException(404, "Subscription not found")
    auto = bool(data.get("auto_renew", True))
    settings_data = {"auto_renew": auto}
    hotel = await session.get(Hotel, hotel_id)
    if hotel:
        s = dict(hotel.settings or {})
        s["auto_renew"] = auto
        hotel.settings = s
        hotel.updated_at = datetime.utcnow()
        session.add(hotel)
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=hotel_id,
        action="AUTO_RENEW_TOGGLE",
        description=f"Auto-renew {'enabled' if auto else 'disabled'} for {hotel_id}",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    return {"hotel_id": hotel_id, **settings_data}
