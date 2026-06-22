from typing import Optional

import stripe

from app.config import settings
from app.shared.db.firestore import db_get, db_update
from app.shared.constants.plans import PLAN_CONFIG


def _stripe():
    stripe.api_key = settings.stripe_api_key
    return stripe


def _price_id(plan: str, billing_cycle: str) -> str:
    key = f'stripe_{plan}_{billing_cycle}_price_id'
    return getattr(settings, key, '')


class BillingService:
    async def get_billing_info(self, agency_id: str) -> dict:
        agency = await db_get('agencies', agency_id)
        if not agency:
            raise ValueError('Agency not found')

        customer_id = agency.get('stripe_customer_id')
        invoices = []

        if customer_id:
            try:
                s = _stripe()
                stripe_invoices = s.Invoice.list(customer=customer_id, limit=10)
                for inv in stripe_invoices.get('data', []):
                    invoices.append({
                        'invoice_id': inv['id'],
                        'amount': inv.get('amount_paid', 0),
                        'currency': inv.get('currency', 'jpy'),
                        'status': inv.get('status', ''),
                        'period_start': str(inv.get('period_start', '')),
                        'period_end': str(inv.get('period_end', '')),
                        'pdf_url': inv.get('invoice_pdf'),
                        'created_at': str(inv.get('created', '')),
                    })
            except Exception:
                pass

        subscription_end = None
        if customer_id:
            try:
                s = _stripe()
                subs = s.Subscription.list(customer=customer_id, limit=1)
                if subs.get('data'):
                    sub = subs['data'][0]
                    subscription_end = str(sub.get('current_period_end', ''))
            except Exception:
                pass

        return {
            'plan': agency.get('plan', 'starter'),
            'billing_cycle': agency.get('billing_cycle', 'monthly'),
            'status': agency.get('status', 'trial'),
            'current_period_end': subscription_end,
            'stripe_customer_id': customer_id,
            'invoices': invoices,
        }

    async def create_checkout_session(
        self,
        agency_id: str,
        agency_name: str,
        email: str,
        plan: str,
        billing_cycle: str,
        success_url: str,
        cancel_url: str,
    ) -> str:
        s = _stripe()
        price_id = _price_id(plan, billing_cycle)
        if not price_id:
            raise ValueError(f'No price ID configured for {plan}/{billing_cycle}')

        agency = await db_get('agencies', agency_id)
        customer_id = agency.get('stripe_customer_id') if agency else None

        params = {
            'payment_method_types': ['card'],
            'line_items': [{'price': price_id, 'quantity': 1}],
            'mode': 'subscription',
            'success_url': success_url,
            'cancel_url': cancel_url,
            'metadata': {'agency_id': agency_id, 'plan': plan, 'billing_cycle': billing_cycle},
        }

        if customer_id:
            params['customer'] = customer_id
        else:
            params['customer_email'] = email

        session = s.checkout.Session.create(**params)
        return session['url']

    async def create_portal_session(self, agency_id: str, return_url: str) -> str:
        agency = await db_get('agencies', agency_id)
        customer_id = agency.get('stripe_customer_id') if agency else None
        if not customer_id:
            raise ValueError('No Stripe customer found. Please subscribe to a plan first.')

        s = _stripe()
        session = s.billing_portal.Session.create(
            customer=customer_id,
            return_url=return_url,
        )
        return session['url']

    async def handle_webhook(self, payload: bytes, sig_header: str) -> dict:
        s = _stripe()
        try:
            event = s.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)
        except Exception as e:
            raise ValueError(f'Webhook signature verification failed: {e}')

        event_type = event['type']
        data = event['data']['object']

        if event_type == 'checkout.session.completed':
            await self._handle_checkout_completed(data)
        elif event_type in ('customer.subscription.updated', 'customer.subscription.created'):
            await self._handle_subscription_updated(data)
        elif event_type == 'customer.subscription.deleted':
            await self._handle_subscription_deleted(data)
        elif event_type == 'invoice.payment_failed':
            await self._handle_payment_failed(data)

        return {'received': True}

    async def _handle_checkout_completed(self, session: dict) -> None:
        metadata = session.get('metadata', {})
        agency_id = metadata.get('agency_id')
        plan = metadata.get('plan', 'starter')
        billing_cycle = metadata.get('billing_cycle', 'monthly')
        customer_id = session.get('customer')

        if not agency_id:
            return

        plan_config = PLAN_CONFIG.get(plan, PLAN_CONFIG['starter'])
        updates = {
            'stripe_customer_id': customer_id,
            'plan': plan,
            'billing_cycle': billing_cycle,
            'status': 'active',
            'included_child_accounts': plan_config['included_child_accounts'],
            'max_child_accounts': plan_config['max_child_accounts'],
            'credits_per_child': plan_config['credits_per_child'],
            'included_clients': plan_config['included_clients'],
            'max_clients': plan_config['max_clients'],
        }
        await db_update('agencies', agency_id, updates)

    async def _handle_subscription_updated(self, subscription: dict) -> None:
        metadata = subscription.get('metadata', {})
        agency_id = metadata.get('agency_id')
        if not agency_id:
            return

        status_map = {
            'active': 'active',
            'past_due': 'past_due',
            'canceled': 'canceled',
            'trialing': 'trial',
        }
        stripe_status = subscription.get('status', '')
        updates = {'status': status_map.get(stripe_status, stripe_status)}
        await db_update('agencies', agency_id, updates)

    async def _handle_subscription_deleted(self, subscription: dict) -> None:
        metadata = subscription.get('metadata', {})
        agency_id = metadata.get('agency_id')
        if agency_id:
            await db_update('agencies', agency_id, {'status': 'canceled'})

    async def _handle_payment_failed(self, invoice: dict) -> None:
        customer_id = invoice.get('customer')
        if not customer_id:
            return
        from app.shared.db.firestore import db_query
        agencies = await db_query('agencies', filters=[('stripe_customer_id', '==', customer_id)], limit=1)
        if agencies:
            await db_update('agencies', agencies[0]['_id'], {'status': 'past_due'})
