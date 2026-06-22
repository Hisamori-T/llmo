from typing import Literal

Plan = Literal['starter', 'pro', 'enterprise']
Role = Literal['admin', 'staff', 'viewer']

PLAN_CONFIG = {
    'starter': {
        'monthly_price': 15000,
        'yearly_price': 144000,
        'included_child_accounts': 2,
        'max_child_accounts': 5,
        'credits_per_child': 100,
        'included_clients': 10,
        'max_clients': 30,
    },
    'pro': {
        'monthly_price': 30000,
        'yearly_price': 288000,
        'included_child_accounts': 5,
        'max_child_accounts': 15,
        'credits_per_child': 200,
        'included_clients': 30,
        'max_clients': 100,
    },
    'enterprise': {
        'monthly_price': 80000,
        'yearly_price': 768000,
        'included_child_accounts': 15,
        'max_child_accounts': 999,
        'credits_per_child': 500,
        'included_clients': 100,
        'max_clients': 9999,
    },
}

CREDIT_COSTS = {
    'keyword_generation': 3,
    'simple_diagnosis': 5,
    'detailed_diagnosis': 15,
    'simple_pdf': 2,
    'detailed_pdf': 5,
}

ROLES = {
    'admin': {'can_manage_team': True, 'can_manage_billing': True, 'can_run_diagnosis': True, 'can_view_all': True},
    'staff': {'can_manage_team': False, 'can_manage_billing': False, 'can_run_diagnosis': True, 'can_view_all': False},
    'viewer': {'can_manage_team': False, 'can_manage_billing': False, 'can_run_diagnosis': False, 'can_view_all': False},
}
