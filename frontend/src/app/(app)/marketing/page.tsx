'use client';

import { Badge, Button, Card, CardBody, EmptyState, ErrorState, Input, Label, LoadingState } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { usePermissions } from '@/lib/roles';
import { formatDate } from '@/lib/utils';
import { Plus } from 'lucide-react';
import { useState } from 'react';

export default function MarketingPage() {
  const assets = useApi<{ data: any[] }>('/content?limit=50');
  const calendar = useApi<{ data: any[] }>('/content-calendar');
  const { canOperate, canManage } = usePermissions();
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const doAction = async (id: string, fn: () => Promise<any>, okMsg: string) => {
    setBusyId(id);
    setMsg(null);
    try {
      await fn();
      assets.reload();
      calendar.reload();
      setMsg(okMsg);
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Thao tác thất bại');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Marketing</h1>
          <p className="text-sm text-gray-500">Nội dung & lịch đăng đa kênh</p>
        </div>
        {canOperate && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> Tạo nội dung
          </Button>
        )}
      </div>

      {msg && <div className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{msg}</div>}

      <Card>
        <CardBody>
          <h2 className="mb-4 text-base font-semibold text-gray-800">Nội dung</h2>
          {assets.loading ? (
            <LoadingState />
          ) : assets.error ? (
            <ErrorState message={assets.error} onRetry={assets.reload} />
          ) : assets.data!.data.length === 0 ? (
            <EmptyState title="Chưa có nội dung" hint="Nhấn “Tạo nội dung”" />
          ) : (
            <div className="space-y-2">
              {assets.data!.data.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800">{a.title || a.contentType}</p>
                    <p className="truncate text-xs text-gray-400">
                      {a.contentType} · {a.platform || 'đa kênh'} · <Badge tone={a.status}>{a.status}</Badge>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {a.status === 'draft' && canOperate && (
                      <Button size="sm" variant="secondary" loading={busyId === a.id} onClick={() => doAction(a.id, () => api.patch(`/content/${a.id}/submit`), 'Đã gửi duyệt.')}>
                        Gửi duyệt
                      </Button>
                    )}
                    {a.status === 'pending_review' && canManage && (
                      <Button size="sm" loading={busyId === a.id} onClick={() => doAction(a.id, () => api.patch(`/content/${a.id}/approve`, { approved: true }), 'Đã duyệt.')}>
                        Duyệt
                      </Button>
                    )}
                    {a.status === 'approved' && canManage && (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={busyId === a.id}
                        onClick={() =>
                          doAction(a.id, () => api.post(`/content/${a.id}/schedule`, { scheduled_date: new Date().toISOString().slice(0, 10) }), 'Đã lên lịch.')
                        }
                      >
                        Lên lịch
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="mb-4 text-base font-semibold text-gray-800">Lịch đăng</h2>
          {calendar.loading ? (
            <LoadingState />
          ) : (calendar.data?.data.length ?? 0) === 0 ? (
            <EmptyState title="Chưa có lịch đăng" />
          ) : (
            <div className="space-y-2">
              {calendar.data!.data.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-gray-100 p-3 text-sm">
                  <span className="text-gray-700">{c.contentAsset?.title || c.contentAsset?.contentType}</span>
                  <span className="text-gray-500">
                    {formatDate(c.scheduledDate)} <Badge tone={c.status}>{c.status}</Badge>
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {showCreate && <CreateContentModal onClose={() => setShowCreate(false)} onCreated={() => { assets.reload(); }} />}
    </div>
  );
}

function CreateContentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ content_type: 'caption', platform: 'tiktok', title: '', content: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      await api.post('/content', form);
      onCreated();
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Không thể tạo nội dung');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <Card className="relative z-10 w-full max-w-lg">
        <CardBody>
          <h2 className="mb-4 text-lg font-semibold text-gray-800">Tạo nội dung</h2>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ct">Loại</Label>
                <select
                  id="ct"
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
                  value={form.content_type}
                  onChange={(e) => setForm({ ...form, content_type: e.target.value })}
                >
                  <option value="caption">Caption</option>
                  <option value="product_description">Mô tả SP</option>
                  <option value="video_script">Kịch bản video</option>
                  <option value="social_post">Bài đăng MXH</option>
                  <option value="email">Email</option>
                </select>
              </div>
              <div>
                <Label htmlFor="pf">Kênh</Label>
                <Input id="pf" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="ti">Tiêu đề</Label>
              <Input id="ti" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="co">Nội dung</Label>
              <textarea
                id="co"
                className="min-h-[120px] w-full rounded-lg border border-gray-200 bg-white p-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
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
