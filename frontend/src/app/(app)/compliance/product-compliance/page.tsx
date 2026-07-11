'use client';

import { Badge, Button, Card, CardBody, EmptyState, ErrorState, Input, Label, LoadingState, PageHeader, TableWrap } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { usePermissions } from '@/lib/roles';
import { formatDate } from '@/lib/utils';
import { Plus } from 'lucide-react';
import { useState } from 'react';

const COMPLIANCE_CLASSES = [
  'ALLOWED',
  'RESTRICTED',
  'LICENSE_REQUIRED',
  'PLATFORM_RESTRICTED',
  'HUMAN_REVIEW_REQUIRED',
  'PROHIBITED',
];

const PERMISSIONS = ['ALLOWED', 'DENIED', 'HUMAN_REVIEW_REQUIRED'];

const STATUSES = ['DRAFT', 'ACTIVE', 'SUSPENDED'];

const SELECT_CLASS =
  'h-10 w-full rounded-xl border border-ink-200 bg-white/85 px-3 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100';

function classTone(value: string): string {
  if (value === 'ALLOWED') return 'completed';
  if (value === 'PROHIBITED') return 'cancelled';
  return 'pending';
}

export default function ProductCompliancePage() {
  const items = useApi<{ data: any[] }>('/compliance/product-compliance?limit=100');
  const { canManage } = usePermissions();
  const [showCreate, setShowCreate] = useState(false);

  const rows = items.data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Product Compliance"
        title="Tuân thủ sản phẩm"
        description="Phân loại sản phẩm và tách riêng quyền BÁN với quyền QUẢNG CÁO trước khi agent hành động."
        action={
          canManage ? (
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> Gán tuân thủ
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardBody>
          <h2 className="mb-4 text-lg font-semibold text-ink-950">Danh mục tuân thủ sản phẩm</h2>
          {items.loading ? (
            <LoadingState />
          ) : items.error ? (
            <ErrorState message={items.error} onRetry={items.reload} />
          ) : rows.length === 0 ? (
            <EmptyState title="Chưa có bản ghi tuân thủ" hint={canManage ? 'Nhấn “Gán tuân thủ”' : undefined} />
          ) : (
            <TableWrap>
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400">
                    <th className="px-4 py-3 font-semibold">Sản phẩm</th>
                    <th className="px-4 py-3 font-semibold">Danh mục</th>
                    <th className="px-4 py-3 font-semibold">Phân loại</th>
                    <th className="px-4 py-3 font-semibold">Được bán</th>
                    <th className="px-4 py-3 font-semibold">Được quảng cáo</th>
                    <th className="px-4 py-3 font-semibold">Trạng thái</th>
                    <th className="px-4 py-3 font-semibold">Rà soát</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-ink-100/70 last:border-0">
                      <td className="px-4 py-3 font-mono text-xs text-ink-700">{r.productId}</td>
                      <td className="px-4 py-3 text-ink-600">{r.category || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge tone={classTone(r.complianceClass)}>{r.complianceClass}</Badge>
                      </td>
                      <td className="px-4 py-3 text-ink-600">{r.sellPermission}</td>
                      <td className="px-4 py-3 text-ink-600">{r.advertisePermission}</td>
                      <td className="px-4 py-3 text-ink-600">{r.status}</td>
                      <td className="px-4 py-3 text-xs text-ink-500">{r.reviewedAt ? formatDate(r.reviewedAt) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </CardBody>
      </Card>

      {showCreate && canManage && (
        <UpsertComplianceModal onClose={() => setShowCreate(false)} onCreated={() => items.reload()} />
      )}
    </div>
  );
}

function UpsertComplianceModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    productId: '',
    category: '',
    complianceClass: 'ALLOWED',
    sellPermission: 'ALLOWED',
    advertisePermission: 'ALLOWED',
    status: 'DRAFT',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setOk(null);
    setSaving(true);
    try {
      await api.post('/compliance/product-compliance', form);
      setOk('Đã gán tuân thủ sản phẩm.');
      onCreated();
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Không thể gán tuân thủ sản phẩm');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={onClose} />
      <Card className="relative z-10 w-full max-w-lg">
        <CardBody>
          <h2 className="mb-4 text-lg font-semibold text-ink-950">Gán tuân thủ sản phẩm</h2>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label htmlFor="productId">Sản phẩm (UUID)</Label>
              <Input
                id="productId"
                value={form.productId}
                onChange={(e) => setForm({ ...form, productId: e.target.value })}
                placeholder="00000000-0000-0000-0000-000000000000"
                required
              />
            </div>
            <div>
              <Label htmlFor="category">Danh mục</Label>
              <Input id="category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="complianceClass">Phân loại</Label>
              <select
                id="complianceClass"
                className={SELECT_CLASS}
                value={form.complianceClass}
                onChange={(e) => setForm({ ...form, complianceClass: e.target.value })}
              >
                {COMPLIANCE_CLASSES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="sellPermission">Được bán</Label>
                <select
                  id="sellPermission"
                  className={SELECT_CLASS}
                  value={form.sellPermission}
                  onChange={(e) => setForm({ ...form, sellPermission: e.target.value })}
                >
                  {PERMISSIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="advertisePermission">Được quảng cáo</Label>
                <select
                  id="advertisePermission"
                  className={SELECT_CLASS}
                  value={form.advertisePermission}
                  onChange={(e) => setForm({ ...form, advertisePermission: e.target.value })}
                >
                  {PERMISSIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="status">Trạng thái</Label>
              <select
                id="status"
                className={SELECT_CLASS}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            {ok && <div className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-700">{ok}</div>}
            {err && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Hủy
              </Button>
              <Button type="submit" loading={saving}>
                Gán tuân thủ
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
