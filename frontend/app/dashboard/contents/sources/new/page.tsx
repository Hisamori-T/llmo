'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';

interface Client {
  client_id: string;
  name: string;
}

type SourceType = 'interview' | 'doc' | 'url';

interface ScaffoldItem {
  geo_key?: string;
  question?: string;
  hint?: string;
  heading?: string;
}

interface TemplateEntry {
  source_type: string;
  label: string;
  needs_body_scaffold: boolean;
  scaffold: ScaffoldItem[] | null;
}

interface GapItem {
  geo_key: string;
  message: string;
}

const TYPE_OPTIONS: { value: SourceType; label: string; description: string }[] = [
  { value: 'interview', label: 'インタビュー', description: '社員・顧客へのインタビュー内容' },
  { value: 'doc',       label: 'ドキュメント', description: '社内文書・マニュアル・ホワイトペーパー' },
  { value: 'url',       label: 'URL',          description: '参照したいWebページのURL' },
];

function buildScaffoldText(tmpl: TemplateEntry): string {
  if (!tmpl.needs_body_scaffold || !tmpl.scaffold) return '';
  if (tmpl.source_type === 'interview') {
    return tmpl.scaffold
      .filter((s) => s.question)
      .map((s, i) => `Q${i + 1}. ${s.question}\nA. `)
      .join('\n\n');
  }
  // doc: heading structure
  return tmpl.scaffold
    .filter((s) => s.heading)
    .map((s) => `## ${s.heading}\n`)
    .join('\n');
}

export default function NewSourcePage() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [templates, setTemplates] = useState<Record<string, TemplateEntry>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // フォーム値（保存契約に対応するフィールドのみ）
  const [clientId, setClientId] = useState('');
  const [sourceType, setSourceType] = useState<SourceType>('interview');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  // AI補助
  const [checkingGap, setCheckingGap] = useState(false);
  const [gapResults, setGapResults] = useState<GapItem[] | null>(null);
  const [structuring, setStructuring] = useState(false);
  const [structurePreview, setStructurePreview] = useState<string | null>(null);

  // クライアント一覧 + テンプレート一覧を同時取得
  useEffect(() => {
    apiClient.get('/clients')
      .then((res) => {
        const list: Client[] = res.data || [];
        setClients(list);
        if (list.length > 0) setClientId(list[0].client_id);
      })
      .catch(() => {})
      .finally(() => setLoadingClients(false));

    apiClient.get('/contents/templates')
      .then((res) => setTemplates(res.data?.templates ?? {}))
      .catch(() => {});
  }, []);

  // テンプレート初回ロード時に本文が空なら雛形をプリフィル
  useEffect(() => {
    if (Object.keys(templates).length === 0) return;
    if (body !== '') return;
    const tmpl = templates[sourceType];
    if (tmpl?.needs_body_scaffold) {
      setBody(buildScaffoldText(tmpl));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates]);

  // 種別変更（既入力があれば上書き確認）
  function handleTypeChange(newType: SourceType) {
    if (newType === sourceType) return;
    if (body.trim()) {
      if (!window.confirm('本文が上書きされます。続けますか？')) return;
    }
    setSourceType(newType);
    setGapResults(null);
    setStructurePreview(null);
    const tmpl = templates[newType];
    if (tmpl?.needs_body_scaffold) {
      setBody(buildScaffoldText(tmpl));
    } else {
      setBody('');
    }
  }

  // AI補助: 不足チェック
  async function handleGapCheck() {
    if (!body.trim() || sourceType === 'url') return;
    setCheckingGap(true);
    setGapResults(null);
    try {
      const res = await apiClient.post('/contents/ai-assist', {
        mode: 'gap_check',
        source_type: sourceType,
        text: body,
      });
      setGapResults(res.data.missing ?? []);
      await refreshUser();
    } catch (e: any) {
      if (e?.response?.status === 402) {
        toast.error('クレジットが不足しています');
      } else {
        toast.error('AI補助に失敗しました');
      }
    } finally {
      setCheckingGap(false);
    }
  }

  // AI補助: 整形
  async function handleStructure() {
    if (!body.trim() || sourceType === 'url') return;
    setStructuring(true);
    setStructurePreview(null);
    try {
      const res = await apiClient.post('/contents/ai-assist', {
        mode: 'structure',
        source_type: sourceType,
        text: body,
      });
      setStructurePreview(res.data.structured_text ?? '');
      await refreshUser();
    } catch (e: any) {
      if (e?.response?.status === 402) {
        toast.error('クレジットが不足しています');
      } else {
        toast.error('AI補助に失敗しました');
      }
    } finally {
      setStructuring(false);
    }
  }

  // 送信（保存契約・バリデーション・遷移は無改変）
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) { setFormError('クライアントを選択してください'); return; }
    if (!title.trim()) { setFormError('タイトルを入力してください'); return; }

    setSubmitting(true);
    setFormError(null);
    try {
      await apiClient.post('/contents/sources', {
        client_id: clientId,
        type: sourceType,
        title: title.trim(),
        body: body.trim(),
        source_url: sourceUrl.trim(),
      });
      router.push('/dashboard/contents?tab=sources');
    } catch (e: any) {
      setFormError(e?.response?.data?.detail ?? '一次情報の登録に失敗しました');
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* 戻りリンク */}
      <Link
        href="/dashboard/contents"
        className="inline-flex items-center gap-1 text-[13px] text-ink-500 hover:text-ink-800 no-underline"
      >
        <span className="material-symbols-outlined text-[16px]">chevron_left</span>
        コンテンツ一覧
      </Link>

      {/* ページタイトル */}
      <div>
        <h1 className="text-[22px] font-bold text-ink-800 leading-tight">一次情報を追加</h1>
        <p className="text-[13px] text-ink-400 mt-1">記事生成の根拠となる情報を登録します</p>
      </div>

      {/* フォームエラー */}
      {formError && (
        <div className="flex items-start gap-2 px-4 py-3 bg-danger-bg border border-danger rounded text-[13px] text-danger">
          <span className="material-symbols-outlined text-[16px] mt-0.5 flex-shrink-0">error</span>
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card className="p-6 space-y-6">

          {/* クライアント */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-ink-600" htmlFor="client">
              クライアント
            </label>
            {loadingClients ? (
              <div className="h-10 bg-surface-subtle rounded animate-pulse" />
            ) : (
              <Select
                id="client"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
              >
                {clients.length === 0 && <option value="">クライアントがいません</option>}
                {clients.map((c) => (
                  <option key={c.client_id} value={c.client_id}>{c.name}</option>
                ))}
              </Select>
            )}
          </div>

          {/* 種別カード */}
          <div className="space-y-2">
            <span className="text-[13px] font-semibold text-ink-600">情報の種別</span>
            <div className="grid grid-cols-3 gap-3">
              {TYPE_OPTIONS.map(({ value, label, description }) => {
                const active = sourceType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleTypeChange(value)}
                    className={`flex flex-col items-start p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                      active
                        ? 'bg-primary-50 border-primary-600'
                        : 'bg-[#FDFBF5] border-border hover:bg-surface-hover'
                    }`}
                  >
                    <span className={`text-[13px] font-semibold ${active ? 'text-primary-700' : 'text-ink-700'}`}>
                      {label}
                    </span>
                    <span className="text-[12px] text-ink-400 mt-0.5">{description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* タイトル */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-ink-600" htmlFor="title">
              タイトル <span className="text-danger">*</span>
            </label>
            <Input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：代表インタビュー 2026年1月"
              required
            />
          </div>

          {/* URL（url 種別のみ） */}
          {sourceType === 'url' && (
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-ink-600" htmlFor="source-url">URL</label>
              <Input
                id="source-url"
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://example.com/article"
              />
            </div>
          )}

          {/* 本文 + AI補助 */}
          <div className="space-y-2">
            <label className="text-[13px] font-semibold text-ink-600" htmlFor="body">
              {sourceType === 'url' ? '概要・補足（任意）' : '本文'}
            </label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              placeholder={
                sourceType === 'interview'
                  ? 'Q. ○○について教えてください\nA. …'
                  : sourceType === 'doc'
                  ? 'ドキュメントの内容をペーストしてください'
                  : 'ページの概要や補足情報（任意）'
              }
            />

            {/* AI補助ボタン（url 以外のみ） */}
            {sourceType !== 'url' && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  icon="fact_check"
                  onClick={handleGapCheck}
                  disabled={checkingGap || structuring || !body.trim()}
                >
                  {checkingGap ? 'チェック中…' : '不足をチェック'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  icon="auto_fix_high"
                  onClick={handleStructure}
                  disabled={structuring || checkingGap || !body.trim()}
                >
                  {structuring ? '整形中…' : '整形する'}
                </Button>
              </div>
            )}

            {/* gap_check 結果 */}
            {gapResults !== null && (
              <div className="space-y-1.5">
                {gapResults.length === 0 ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-success-bg border border-success rounded text-[13px] text-success">
                    <span className="material-symbols-outlined text-[15px] flex-shrink-0">check_circle</span>
                    GEO5原則を満たしています
                  </div>
                ) : (
                  gapResults.map((item) => (
                    <div
                      key={item.geo_key}
                      className="flex items-start gap-2 px-3 py-2 bg-warning-bg border border-warning rounded text-[13px] text-warning"
                    >
                      <span className="material-symbols-outlined text-[15px] mt-0.5 flex-shrink-0">warning</span>
                      {item.message}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* structure プレビュー */}
            {structurePreview !== null && (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-surface-subtle border-b border-border-divider">
                  <span className="text-[12px] font-semibold text-ink-600">整形プレビュー</span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => { setBody(structurePreview); setStructurePreview(null); }}
                    >
                      反映
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setStructurePreview(null)}
                    >
                      キャンセル
                    </Button>
                  </div>
                </div>
                <pre className="p-4 text-[12px] text-ink-700 bg-[#FDFBF5] whitespace-pre-wrap font-sans leading-relaxed max-h-56 overflow-y-auto">
                  {structurePreview}
                </pre>
              </div>
            )}
          </div>

          {/* 送信ボタン */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              variant="primary"
              disabled={submitting || loadingClients}
            >
              {submitting ? '登録中…' : '一次情報を登録'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push('/dashboard/contents')}
            >
              キャンセル
            </Button>
          </div>

        </Card>
      </form>
    </div>
  );
}
