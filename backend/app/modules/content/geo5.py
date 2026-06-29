"""GEO5原則の唯一の定義。全ての参照元はこのモジュールを使うこと（二重定義禁止）。
SSOT: LLMO-Score-COMPLETE-FINAL-v4.md L478 / DESIGN-content-primary-info-and-keyword-v1.md §3.3
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class Geo5Principle:
    key: str            # machine-readable key（テンプレート・AI補助で参照）
    name: str           # 表示名
    content: str        # 原則の内容説明
    guiding_question: str  # ユーザーへの誘導質問（インタビュー雛形で使用）
    check: str          # AI補助の不足指摘メッセージ


GEO5_PRINCIPLES: list[Geo5Principle] = [
    Geo5Principle(
        key='citation',
        name='引用可能性',
        content='AIが直接引用できる具体的な文章（固有名詞・実績数値・地名を含む文）',
        guiding_question='AIが直接引用できる具体的な一文を書いてください（固有名詞・実績数値・地名を含む文）',
        check='AIが引用できる固有名詞・実績数値・地名を含む具体的な文章がありません',
    ),
    Geo5Principle(
        key='numbers',
        name='数値',
        content='定量データを最低3箇所（年数・件数・費用・割合・面積など）',
        guiding_question='具体的な数字を教えてください（年数・件数・費用・割合など、最低3つ）',
        check='定量データ（年数・件数・費用・割合など）が3箇所未満です',
    ),
    Geo5Principle(
        key='statistics',
        name='統計/調査',
        content='業界統計または調査結果を1箇所以上（「〜調査によると」「〜年時点で〜%」など）',
        guiding_question='業界統計や調査データはありますか？（「〜調査によると」「〜年時点で〜%」など）',
        check='業界統計や調査データが含まれていません',
    ),
    Geo5Principle(
        key='authority',
        name='権威性',
        content='専門資格・受賞歴・施工実績・年数・メディア掲載など信頼指標を記述',
        guiding_question='御社の権威性・信頼指標を教えてください（専門資格・受賞歴・施工実績・年数・メディア掲載など）',
        check='専門資格・受賞歴・施工実績などの権威性指標が含まれていません',
    ),
    Geo5Principle(
        key='conclusion',
        name='簡潔な結論',
        content='各セクション末または記事末に、AIが引用しやすい1〜2文の要約',
        guiding_question='このトピックについて、AIが引用しやすい1〜2文の結論を書いてください',
        check='各セクションにAIが引用しやすい1〜2文の結論がありません',
    ),
]

GEO5_BY_KEY: dict[str, Geo5Principle] = {p.key: p for p in GEO5_PRINCIPLES}
