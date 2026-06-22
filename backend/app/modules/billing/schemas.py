from pydantic import BaseModel
from typing import Optional


class CheckoutRequest(BaseModel):
    plan: str  # starter / pro / enterprise
    billing_cycle: str = 'monthly'  # monthly / yearly
    success_url: str
    cancel_url: str


class BuyCreditsRequest(BaseModel):
    amount: int  # number of additional credits
    success_url: str
    cancel_url: str


class Invoice(BaseModel):
    invoice_id: str
    amount: int
    currency: str
    status: str
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    pdf_url: Optional[str] = None
    created_at: str


class BillingInfo(BaseModel):
    plan: str
    billing_cycle: str
    status: str
    current_period_end: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    invoices: list[Invoice] = []
