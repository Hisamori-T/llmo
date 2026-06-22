from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.config import settings
from app.shared.api.deps import CurrentUser, get_current_user, require_role
from .schemas import BillingInfo, CheckoutRequest, Invoice
from .services import BillingService

router = APIRouter(tags=['billing'])
_svc = BillingService()


@router.get('/info', response_model=BillingInfo)
async def get_billing_info(current_user: CurrentUser = Depends(require_role('admin'))):
    try:
        info = await _svc.get_billing_info(current_user.agency_id)
        invoices = [Invoice(**inv) for inv in info.pop('invoices', [])]
        return BillingInfo(**info, invoices=invoices)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post('/checkout', response_model=dict)
async def create_checkout(
    body: CheckoutRequest,
    current_user: CurrentUser = Depends(require_role('admin')),
):
    if body.plan not in ('starter', 'pro', 'enterprise'):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail='Invalid plan')
    if body.billing_cycle not in ('monthly', 'yearly'):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail='Invalid billing_cycle')
    try:
        url = await _svc.create_checkout_session(
            agency_id=current_user.agency_id,
            agency_name='',
            email=current_user.email,
            plan=body.plan,
            billing_cycle=body.billing_cycle,
            success_url=body.success_url,
            cancel_url=body.cancel_url,
        )
        return {'checkout_url': url}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post('/portal', response_model=dict)
async def create_portal(
    current_user: CurrentUser = Depends(require_role('admin')),
):
    return_url = f'{settings.app_url}/dashboard/billing'
    try:
        url = await _svc.create_portal_session(current_user.agency_id, return_url)
        return {'portal_url': url}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post('/webhook', status_code=status.HTTP_200_OK)
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature', '')
    try:
        return await _svc.handle_webhook(payload, sig_header)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
