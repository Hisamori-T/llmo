import stripe
from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from models.database import get_db
from models.models import User, Organization, Subscription, PlanEnum
from middleware.auth_middleware import get_current_user
from core.config import settings

router = APIRouter()
stripe.api_key = settings.stripe_api_key

PLAN_PRICE_IDS = {
    ('starter', 'monthly'): settings.stripe_starter_monthly_price_id,
    ('starter', 'yearly'): settings.stripe_starter_yearly_price_id,
    ('pro', 'monthly'): settings.stripe_pro_monthly_price_id,
    ('pro', 'yearly'): settings.stripe_pro_yearly_price_id,
    ('enterprise', 'monthly'): settings.stripe_enterprise_monthly_price_id,
    ('enterprise', 'yearly'): settings.stripe_enterprise_yearly_price_id,
}

PLAN_CREDITS = {'starter': 100, 'pro': 500, 'enterprise': 2000}

class CheckoutRequest(BaseModel):
    plan_id: str
    billing_cycle: str = 'monthly'

class CreditsRequest(BaseModel):
    credits: int

@router.post('/checkout')
async def create_checkout(req: CheckoutRequest, current_user: User = Depends(get_current_user)):
    price_id = PLAN_PRICE_IDS.get((req.plan_id, req.billing_cycle))
    if not price_id:
        raise HTTPException(status_code=400, detail='Invalid plan or billing cycle')

    session = stripe.checkout.Session.create(
        payment_method_types=['card'],
        line_items=[{'price': price_id, 'quantity': 1}],
        mode='subscription',
        customer_email=current_user.email,
        success_url=f'{settings.app_url}/dashboard?success=true',
        cancel_url=f'{settings.app_url}/dashboard/billing?canceled=true',
        client_reference_id=current_user.id,
        metadata={'plan_id': req.plan_id, 'billing_cycle': req.billing_cycle, 'user_id': current_user.id},
    )
    return {'checkout_url': session.url}

@router.post('/credits')
async def buy_credits(req: CreditsRequest, current_user: User = Depends(get_current_user)):
    CREDIT_PRICE = {'starter': 1000, 'pro': 800, 'enterprise': 500}
    price_per_100 = CREDIT_PRICE.get(current_user.plan.value, 1000)
    amount = int((req.credits / 100) * price_per_100)

    session = stripe.checkout.Session.create(
        payment_method_types=['card'],
        line_items=[{'price_data': {'currency': 'jpy', 'product_data': {'name': f'{req.credits}クレジット追加'}, 'unit_amount': amount}, 'quantity': 1}],
        mode='payment',
        customer_email=current_user.email,
        success_url=f'{settings.app_url}/dashboard/billing?credits_added=true',
        cancel_url=f'{settings.app_url}/dashboard/billing',
        client_reference_id=current_user.id,
        metadata={'type': 'credits', 'credits': req.credits, 'user_id': current_user.id},
    )
    return {'checkout_url': session.url}

@router.post('/portal')
async def billing_portal(current_user: User = Depends(get_current_user)):
    if not current_user.stripe_customer_id:
        raise HTTPException(status_code=400, detail='No Stripe customer found')
    session = stripe.billing_portal.Session.create(
        customer=current_user.stripe_customer_id,
        return_url=f'{settings.app_url}/dashboard/billing',
    )
    return {'url': session.url}

@router.get('/info')
async def get_billing_info(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    invoices = []
    next_billing_date = ''
    monthly_amount = {'starter': 5000, 'pro': 15000, 'enterprise': 50000}.get(current_user.plan.value, 0)

    if current_user.stripe_customer_id:
        try:
            stripe_invoices = stripe.Invoice.list(customer=current_user.stripe_customer_id, limit=10)
            for inv in stripe_invoices.data:
                invoices.append({'id': inv.id, 'amount': inv.amount_paid // 100, 'status': inv.status, 'date': str(inv.created), 'pdfUrl': inv.invoice_pdf})
            sub_list = stripe.Subscription.list(customer=current_user.stripe_customer_id, limit=1)
            if sub_list.data:
                import datetime
                next_billing_date = datetime.datetime.fromtimestamp(sub_list.data[0].current_period_end).isoformat()
        except Exception:
            pass

    return {
        'planName': {'starter': 'Starter', 'pro': 'Pro', 'enterprise': 'Enterprise'}.get(current_user.plan.value, ''),
        'planId': current_user.plan.value,
        'billingCycle': 'monthly',
        'monthlyAmount': monthly_amount,
        'nextBillingDate': next_billing_date,
        'breakdown': {'basePlan': monthly_amount, 'additionalAccounts': 0, 'extraCredits': 0, 'phase3Runs': 0, 'discount': 0},
        'invoices': invoices,
    }

@router.post('/webhook')
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.body()
    sig = request.headers.get('stripe-signature')
    try:
        event = stripe.Webhook.construct_event(payload, sig, settings.stripe_webhook_secret)
    except Exception:
        raise HTTPException(status_code=400, detail='Invalid webhook')

    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        user_id = session.get('client_reference_id')
        meta = session.get('metadata', {})

        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user:
            if meta.get('type') == 'credits':
                user.monthly_credits_used = max(0, user.monthly_credits_used - int(meta.get('credits', 0)))
            elif meta.get('plan_id'):
                plan = PlanEnum(meta['plan_id'])
                user.plan = plan
                if not user.stripe_customer_id:
                    user.stripe_customer_id = session.get('customer')
                result2 = await db.execute(select(Organization).where(Organization.id == user.org_id))
                org = result2.scalar_one_or_none()
                if org:
                    org.plan = plan
                    org.monthly_credits_limit = PLAN_CREDITS.get(meta['plan_id'], 100)
            await db.commit()

    return {'status': 'received'}
