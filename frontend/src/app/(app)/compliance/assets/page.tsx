'use client';

import { Badge, Button, Card, EmptyState, ErrorState, Input, Label, LoadingState, PageHeader, TableWrap } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { usePermissions } from '@/lib/roles';
import { formatDate } from '@/lib/utils';
import { Plus } from 'lucide-react';
import { useState } from 'react';

interface Asset {
  id: string;
  assetId: string;
  owner?: string | null;
  licenseType?: string | null;
  commercialUseAllowed?: boolean;
  paidAdsAllowed?: boolean;
  verificationStatus: string;
  validUntil?: string | null;
}

function statusTone(status: string): string {
  if (status === 'VERIFIED') return 'completed';
  if (status === 'REJECTED' || status === 'EXPIRED') return 'cancelled';
  return 'pending';
}

const EMPTY_FORM = {
  assetId: '',
  owner: '',
  licenseType: '',
  commercialUseAllowed: false,
  paidAdsAllowed: false,
  validUntil: '',
};

export default function AssetsPage() {
  const { canOperate, canManage } = usePermissions();
  const { data, loading, error, reload } = useApi<{ data: Asset[] }>('/compliance/assets?limit=100');
  const [busy, setBusy] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setErr(null);
    setOk(null);
    setOpen(true);
  };

  const verify = async (id: string, status: 'VERIFIED' | 'REJECTED') => {
    setBusy(id);
    setOk(null);
    setErr(null);
    try {
      await api.patch(`/compliance/assets/${id}/verify`, { status });
      setOk(status === 'VERIFIED' ? 'Đã xác minh tài sản.' : 'Đã từ chối tài sản.');
      reload();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Xử lý xác minh thất bại');
    } finally {
      setBusy(null);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    setOk(null);
    try {
      await api.post('/compliance/assets', form);
      setOk('Đã thêm tài sản mới.');
      setOpen(false);
      reload();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Thêm tài sản thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const rows = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Intellectual Property"
        title="Quyền tài sản"
        description="Đăng ký quyền hình ảnh, video, nhạc, logo — chặn auto-publish khi chưa xác minh."
        action={
          canOperate ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Thêm tài sản
            </Button>
          ) : undefined
        }
      />

      {ok && <div className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-700">{ok}</div>}
      {err && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>}

      <Card>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : rows.length === 0 ? (
          <EmptyState title="Chưa có tài sản nào" hint="Thêm tài sản để đăng ký quyền sử dụng." />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left">
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Tài sản</th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Chủ sở hữu</th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">License</th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Dùng TM</th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Quảng cáo trả phí</th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Trạng thái</th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-b border-ink-100/70 last:border-0 hover:bg-brand-50/50">
                    <td className="px-5 py-3.5 font-medium text-ink-900">
                      <span className="font-mono text-xs text-ink-700">{a.assetId}</span>
                    </td>
                    <td className="px-5 py-3.5 text-ink-600">{a.owner || '—'}</td>
                    <td className="px-5 py-3.5 text-ink-600">{a.licenseType || '—'}</td>
                    <td className="px-5 py-3.5 text-ink-600">{a.commercialUseAllowed ? 'Có' : 'Không'}</td>
                    <td className="px-5 py-3.5 text-ink-600">{a.paidAdsAllowed ? 'Có' : 'Không'}</td>
                    <td className="px-5 py-3.5">
                      <Badge tone={statusTone(a.verificationStatus)}>{a.verificationStatus}</Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      {canManage ? (
                        a.verificationStatus !== 'VERIFIED' ? (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              loading={busy === a.id}
                              disabled={busy === a.id}
                              onClick={() => verify(a.id, 'VERIFIED')}
                            >
                              Xác minh
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              loading={busy === a.id}
                              disabled={busy === a.id}
                              onClick={() => verify(a.id, 'REJECTED')}
                            >
                              Từ chối
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-ink-400">—</span>
                        )
                      ) : (
                        <span className="text-xs text-ink-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      {!canManage && <p className="text-xs text-ink-400">Chỉ Manager trở lên mới xác minh được tài sản.</p>}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <Card className="relative z-10 w-full max-w-lg">
            <form onSubmit={submit} className="p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-ink-950">Thêm tài sản</h2>
              <p className="mt-1 text-sm text-ink-500">Đăng ký quyền sử dụng cho tài sản mới.</p>

              <div className="mt-5 space-y-4">
                <div>
                  <Label htmlFor="assetId">Mã tài sản</Label>
                  <Input
                    id="assetId"
                    required
                    value={form.assetId}
                    onChange={(e) => setForm((f) => ({ ...f, assetId: e.target.value }))}
                    placeholder="VD: logo-2026, video-launch"
                  />
                </div>
                <div>
                  <Label htmlFor="owner">Chủ sở hữu</Label>
                  <Input
                    id="owner"
                    value={form.owner}
                    onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="licenseType">License</Label>
                  <Input
                    id="licenseType"
                    value={form.licenseType}
                    onChange={(e) => setForm((f) => ({ ...f, licenseType: e.target.value }))}
                    placeholder="VD: CC-BY, Proprietary"
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-2 text-sm text-ink-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-200"
                      checked={form.commercialUseAllowed}
                      onChange={(e) => setForm((f) => ({ ...f, commercialUseAllowed: e.target.checked }))}
                    />
                    Cho phép dùng thương mại
                  </label>
                  <label className="flex items-center gap-2 text-sm text-ink-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-200"
                      checked={form.paidAdsAllowed}
                      onChange={(e) => setForm((f) => ({ ...f, paidAdsAllowed: e.target.checked }))}
                    />
                    Cho phép quảng cáo trả phí
                  </label>
                </div>
                <div>
                  <Label htmlFor="validUntil">Có hiệu lực đến</Label>
                  <Input
                    id="validUntil"
                    type="date"
                    value={form.validUntil}
                    onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={submitting}>
                  Hủy
                </Button>
                <Button type="submit" loading={submitting} disabled={submitting}>
                  Lưu tài sản
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
