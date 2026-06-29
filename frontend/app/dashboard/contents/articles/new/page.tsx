'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

interface Client {
  client_id: string;
  name: string;
}

interface Source {
  source_id: string;
  client_id: string;
  type: string;
  title: string;
}

interface KwCandidate {
  keyword: string;
  score: number | null;
  weak: boolean;
  label: string;
}

const SOURCE_TYPE_LABEL: Record<string, string> = {
  interview: 'インタビュー',
  doc: 'ドキュメント',
  url: 'URL',
};

export default function NewArticlePage() {
  const router = useRouter();

  const [clients, setClients] = useState<Client[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingSources, setLoadingSources] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // フォーム値（保存契約に対応するフィールド）
  const [clientId, setClientId] = useState('');
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [diagnosisId, setDiagnosisId] = useState('');

  // キーワード管理（chips + 手動入力 + AI候補）
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [candidates, setCandidates] = useState<KwCandidate[] | null>(null);
  const [candidateSource, setCandidateSource] = useState<'diagnosis' | 'fallback' | null>(null);

  useEffect(() => {
    apiClient.get('/clients')
      .then((res) => {
        const list: Client[] = res.data || [];
        setClients(list);
        if (list.length > 0) setClientId(list[0].client_id);
      })
      .catch(() => {})
      .finally(() => setLoadingClients(false));
  }, []);

  useEffect(() => {
    if (!clientId) return;
    setLoadingSources(true);
    setSelectedSources([]);
    setCandidates(null);
    setCandidateSource(null);
    apiClient.get(`/contents/sources?client_id=${clientId}`)
      .then((res) => setSources(res.data || []))
      .catch(() => {})
      .finally(() => setLoadingSources(false));
  }, [clientId]);

  function toggleSource(sourceId: string) {
    setSelectedSources((prev) =>
      prev.includes(sourceId) ? prev.filter((id) => id !== sourceId) : [...prev, sourceId]
    );
  }

  function addKeyword(kw: string) {
    const trimmed = kw.trim();
    if (!trimmed || selectedKeywords.includes(trimmed)) return;
    setSelectedKeywords((prev) => [...prev, trimmed]);
  }

  function addManualKeyword() {
    addKeyword(keywordInput);
    setKeywordInput('');
  }

  function handleKeywordKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addManualKeyword();
    }
  }

  async function handleGetCandidates() {
    if (!clientId) return;
    setLoadingCandidates(true);
    setCandidates(null);
    try {
      const res = await apiClient.get(`/contents/keyword-suggestions?client_id=${clientId}`);
      setCandidates(res.data.candidates ?? []);
      setCandidateSource(res.data.source);
    } catch {
      toast.error('キーワード候補の取得に失敗しました');
    } finally {
      setLoadingCandidates(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const allKeywords = [
      ...selectedKeywords,
      ...(keywordInput.trim() ? [keywordInput.trim()] : []),
    ];
    if (!clientId) { setError('クライアントを選択してください'); return; }
    if (allKeywords.length === 0) { setError('ターゲットキーワードを1つ以上入力してください'); return; }
    if (selectedSources.length === 0) { setError('一次情報ソースを1つ以上選択してください'); return; }

    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        client_id: clientId,
        target_keyword: allKeywords[0],   // 後方互換: 単数
        target_keywords: allKeywords,      // 複数KW（D-5）
        source_ids: selectedSources,
      };
      if (diagnosisId.trim()) payload.diagnosis_id = diagnosisId.trim();

      const res = await apiClient.post('/contents/articles', payload);
      router.push(`/dashboard/contents/articles/${res.data.article_id}`);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? '記事生成の開始に失敗しました');
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
        <h1 className="text-[22px] font-bold text-ink-800 leading-tight">記事を生成</h1>
        <p className="text-[13px] text-ink-400 mt-1">GEO5原則（引用可能・定量・統計・権威性・結論）準拠の記事を生成します</p>
      </div>

      {/* エラー */}
      {error && (
        <div className="flex items-start gap-2 px-4 py-3 bg-danger-bg border border-danger rounded text-[13px] text-danger">
          <span className="material-symbols-outlined text-[16px] mt-0.5 flex-shrink-0">error</span>
          {error}
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

          {/* ターゲットキーワード */}
          <div className="space-y-2">
            <span className="text-[13px] font-semibold text-ink-600">
              ターゲットキーワード <span className="text-danger">*</span>
            </span>

            {/* 選択済みチップ */}
            {selectedKeywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 border border-primary-600 text-primary-700 text-[13px] rounded-full"
                  >
                    {kw}
                    <button
                      type="button"
                      onClick={() => setSelectedKeywords((p) => p.filter((k) => k !== kw))}
                      className="text-primary-600 hover:text-primary-700 leading-none"
                      aria-label={`${kw}を削除`}
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* 手動入力 + 追加 + ✨ */}
            <div className="flex items-center gap-2">
              <Input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={handleKeywordKeyDown}
                placeholder="キーワードを入力してEnterで追加"
                className="flex-1 min-w-0"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={addManualKeyword}
                disabled={!keywordInput.trim()}
              >
                追加
              </Button>
              <Button
                type="button"
                variant="secondary"
                icon="auto_awesome"
                onClick={handleGetCandidates}
                disabled={!clientId || loadingCandidates}
              >
                {loadingCandidates ? '取得中…' : 'AIで自動生成'}
              </Button>
            </div>

            {/* AI候補チップ */}
            {candidates !== null && (
              <div className="space-y-2 pt-1">
                {candidateSource === 'fallback' && (
                  <p className="text-[12px] text-ink-400">
                    診断未実施のため業種・エリアから生成しました
                  </p>
                )}
                {candidates.length === 0 ? (
                  <p className="text-[12px] text-ink-400">候補が見つかりませんでした</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {candidates.map((c) => {
                      const isAdded = selectedKeywords.includes(c.keyword);
                      return (
                        <button
                          key={c.keyword}
                          type="button"
                          onClick={() => addKeyword(c.keyword)}
                          disabled={isAdded}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 text-[13px] rounded-full border transition-opacity ${
                            isAdded
                              ? 'opacity-40 cursor-default bg-surface-subtle border-border text-ink-500'
                              : c.weak
                              ? 'bg-warning-bg border-warning text-warning hover:opacity-80 cursor-pointer'
                              : 'bg-surface-subtle border-border text-ink-700 hover:bg-surface-hover cursor-pointer'
                          }`}
                        >
                          {c.label}
                          <span className="material-symbols-outlined text-[13px]">
                            {isAdded ? 'check' : 'add'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 診断ID（任意） */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-ink-600" htmlFor="diagnosis">
              診断ID <span className="text-[12px] font-normal text-ink-400">（任意）</span>
            </label>
            <Input
              id="diagnosis"
              type="text"
              value={diagnosisId}
              onChange={(e) => setDiagnosisId(e.target.value)}
              placeholder="診断スコアを記事に反映する場合に入力"
            />
          </div>

          {/* 一次情報ソース選択 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ink-600">
                一次情報ソース <span className="text-danger">*</span>
              </span>
              {selectedSources.length > 0 && (
                <span className="text-[12px] text-ink-400">{selectedSources.length} 件選択中</span>
              )}
            </div>

            {loadingSources ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 bg-surface-subtle rounded animate-pulse" />
                ))}
              </div>
            ) : sources.length === 0 ? (
              <div className="p-4 bg-surface-subtle rounded-lg text-center">
                <p className="text-[13px] text-ink-500">このクライアントの一次情報がありません</p>
                <Link
                  href="/dashboard/contents/sources/new"
                  className="text-[13px] text-primary-600 hover:text-primary-700 mt-1 inline-block"
                >
                  一次情報を追加する →
                </Link>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto border border-border rounded-lg p-2">
                {sources.map((s) => (
                  <label
                    key={s.source_id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedSources.includes(s.source_id)
                        ? 'bg-primary-50 border border-primary-600'
                        : 'hover:bg-surface-hover border border-transparent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSources.includes(s.source_id)}
                      onChange={() => toggleSource(s.source_id)}
                      className="rounded border-border-strong text-primary-600 focus:ring-primary-600"
                    />
                    <div>
                      <p className="text-[13px] font-medium text-ink-800">{s.title}</p>
                      <span className="text-[12px] text-ink-400">{SOURCE_TYPE_LABEL[s.type] ?? s.type}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* 送信 */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              variant="primary"
              disabled={submitting || loadingClients || sources.length === 0}
            >
              {submitting ? '生成中…' : '記事を生成する'}
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
