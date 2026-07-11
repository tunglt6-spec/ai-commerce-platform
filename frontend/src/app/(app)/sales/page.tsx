'use client';

import { Button, Card, CardBody, EmptyState, ErrorState, Input, Label, LoadingState } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { Plus, Send } from 'lucide-react';
import { useState } from 'react';

export default function SalesPage() {
  const faq = useApi<{ data: any[] }>('/faq');
  const [showCreate, setShowCreate] = useState(false);

  // Sales AI tester
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<any>(null);

  const ask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    setAnswer(null);
    try {
      const res = await api.post('/ai/sales/respond', { question });
      setAnswer(res.data);
    } catch (e) {
      setAnswer({ error: e instanceof ApiError ? e.message : 'Lỗi' });
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-950">Sales & FAQ</h1>
          <p className="text-sm text-ink-500">Trợ lý bán hàng AI & cơ sở tri thức</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> Thêm FAQ
        </Button>
      </div>

      <Card>
        <CardBody>
          <h2 className="mb-3 text-base font-semibold text-ink-900">Thử Sales AI</h2>
          <form onSubmit={ask} className="flex gap-2">
            <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ví dụ: Có size M không? Giao mất bao lâu?" />
            <Button type="submit" loading={asking}>
              <Send className="h-4 w-4" /> Hỏi
            </Button>
          </form>
          {answer && (
            <div className="mt-4 space-y-2">
              {answer.error ? (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{answer.error}</div>
              ) : (
                <>
                  {answer.note && <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{answer.note}</div>}
                  {answer.suggestions?.length ? (
                    answer.suggestions.map((s: string, i: number) => (
                      <div key={i} className="rounded-lg border border-ink-100 bg-ink-50/60 p-3 text-sm text-ink-700">
                        {s}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-ink-500">Không có gợi ý — hãy thêm FAQ liên quan.</p>
                  )}
                </>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="mb-4 text-base font-semibold text-ink-900">Cơ sở tri thức (FAQ)</h2>
          {faq.loading ? (
            <LoadingState />
          ) : faq.error ? (
            <ErrorState message={faq.error} onRetry={faq.reload} />
          ) : faq.data!.data.length === 0 ? (
            <EmptyState title="Chưa có FAQ" hint="Thêm câu hỏi thường gặp để Sales AI dùng" />
          ) : (
            <div className="space-y-2">
              {faq.data!.data.map((f) => (
                <div key={f.id} className="rounded-lg border border-ink-100 p-3">
                  <p className="text-sm font-medium text-ink-900">{f.question}</p>
                  <p className="mt-1 text-sm text-ink-600">{f.answer}</p>
                  <p className="mt-1 text-xs text-ink-400">{f.category}</p>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {showCreate && <CreateFaqModal onClose={() => setShowCreate(false)} onCreated={faq.reload} />}
    </div>
  );
}

function CreateFaqModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ category: 'shipping', question: '', answer: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      await api.post('/faq', form);
      onCreated();
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Không thể tạo FAQ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <Card className="relative z-10 w-full max-w-lg">
        <CardBody>
          <h2 className="mb-4 text-lg font-semibold text-ink-900">Thêm FAQ</h2>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label htmlFor="cat">Danh mục</Label>
              <select
                id="cat"
                className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="shipping">Vận chuyển</option>
                <option value="size_guide">Size</option>
                <option value="return">Hoàn hàng</option>
                <option value="payment">Thanh toán</option>
                <option value="quality">Chất lượng</option>
              </select>
            </div>
            <div>
              <Label htmlFor="q">Câu hỏi</Label>
              <Input id="q" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="a">Trả lời</Label>
              <textarea
                id="a"
                className="min-h-[100px] w-full rounded-lg border border-ink-200 bg-white p-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                value={form.answer}
                onChange={(e) => setForm({ ...form, answer: e.target.value })}
                required
              />
            </div>
            {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Hủy
              </Button>
              <Button type="submit" loading={saving}>
                Tạo
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
