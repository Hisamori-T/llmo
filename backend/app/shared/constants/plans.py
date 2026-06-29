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
    'detailed_diagnosis': 20,  # 多LLM+Tavily化に伴いクレジット増（旧15）
    'optimization': 10,         # STEP2 実装最適化（JSON-LD/FAQ/AI要約生成）
    'content_article': 8,       # GEO5原則記事生成（Gemini）
    'content_ai_assist': 1,     # 一次情報AI補助（gap_check / structure・Gemini単体）
    'simple_pdf': 2,
    'detailed_pdf': 5,
    'automation_monthly': 12,   # 暫定（多LLM自動実行・運用後に調整）
    'automation_weekly': 6,     # 暫定
}

ROLES = {
    'admin': {'can_manage_team': True, 'can_manage_billing': True, 'can_run_diagnosis': True, 'can_view_all': True},
    'staff': {'can_manage_team': False, 'can_manage_billing': False, 'can_run_diagnosis': True, 'can_view_all': False},
    'viewer': {'can_manage_team': False, 'can_manage_billing': False, 'can_run_diagnosis': False, 'can_view_all': False},
}
