"""種別別一次情報テンプレート（雛形データ）。
SSOT: DESIGN-content-primary-info-and-keyword-v1.md §3.2
種別追加はこのファイルへの1エントリ追加のみで完結する（コンポーネント改修不要）。
"""
from .geo5 import GEO5_PRINCIPLES

# key = content_sources.type の値と一致させること（'interview'|'doc'|'url'）
TEMPLATES: dict[str, dict] = {
    'interview': {
        'source_type': 'interview',
        'label': 'インタビュー',
        'description': '社員・顧客へのインタビュー内容',
        'needs_body_scaffold': True,
        'scaffold': [
            {
                'geo_key': p.key,
                'question': p.guiding_question,
                'hint': p.content,
            }
            for p in GEO5_PRINCIPLES
        ],
    },
    'doc': {
        'source_type': 'doc',
        'label': 'ドキュメント',
        'description': '社内文書・マニュアル・ホワイトペーパー',
        'needs_body_scaffold': True,
        'scaffold': [
            {'heading': '要点'},
            {'heading': '根拠データ'},
            {'heading': '結論'},
        ],
    },
    'url': {
        'source_type': 'url',
        'label': 'URL',
        'description': '参照したいWebページのURL',
        'needs_body_scaffold': False,
        'scaffold': None,
    },
}
