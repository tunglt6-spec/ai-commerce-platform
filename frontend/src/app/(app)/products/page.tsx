'use client';

import { Badge, Button, Card, CardBody, EmptyState, ErrorState, Input, Label, LoadingState, PageHeader, TableWrap } from '@/components/ui';
import { api, ApiError, uploadFile } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { usePermissions } from '@/lib/roles';
import { formatVND } from '@/lib/utils';
import { Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface Product {
  id: string;
  sku: string;
  name: string;
  retailPrice: string;
  productScore: string;
  status: string;
  category?: { name: string };
}

export default function ProductsPage() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const { data, loading, error, reload } = useApi<{ data: Product[] }>(
    `/products?limit=50${query ? `&search=${encodeURIComponent(query)}` : ''}`,
  );
  const { canOperate } = usePermissions();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Product AI"
        title="Sản phẩm"
        description="Quản lý danh mục, giá bán, tồn kho và điểm cơ hội AI cho từng sản phẩm."
        action={canOperate && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> Thêm sản phẩm
          </Button>
        )}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search);
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên hoặc SKU..."
            className="pl-9"
          />
        </div>
        <Button variant="secondary" type="submit">
          Tìm
        </Button>
      </form>

      <Card>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : data!.data.length === 0 ? (
          <EmptyState title="Chưa có sản phẩm" hint="Nhấn Thêm sản phẩm để tạo mới." />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-[0.12em] text-ink-400">
                  <th className="px-5 py-4 font-semibold">Sản phẩm</th>
                  <th className="px-5 py-4 font-semibold">Danh mục</th>
                  <th className="px-5 py-4 text-right font-semibold">Giá bán</th>
                  <th className="px-5 py-4 text-right font-semibold">Điểm AI</th>
                  <th className="px-5 py-4 font-semibold">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {data!.data.map((p) => (
                  <tr key={p.id} className="border-b border-ink-100/70 last:border-0 hover:bg-brand-50/50">
                    <td className="px-5 py-4">
                      <Link href={`/products/${p.id}`} className="font-medium text-brand-700 hover:underline">
                        {p.name}
                      </Link>
                      <div className="text-xs text-ink-400">{p.sku}</div>
                    </td>
                    <td className="px-5 py-4 text-ink-600">{p.category?.name ?? '-'}</td>
                    <td className="number px-5 py-4 text-right font-medium text-ink-950">{formatVND(p.retailPrice)}</td>
                    <td className="number px-5 py-4 text-right">
                      <span className="font-semibold text-ink-900">{Number(p.productScore).toFixed(0)}</span>
                      <span className="text-ink-400">/100</span>
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone={p.status}>{p.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      {showCreate && <CreateProductModal onClose={() => setShowCreate(false)} onCreated={reload} />}
    </div>
  );
}

function CreateProductModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { data: cats } = useApi<{ data: { id: string; name: string }[] }>('/categories');
  const [form, setForm] = useState({ sku: '', name: '', category_id: '', cost_price: '', retail_price: '', primary_image_url: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErr(null);
    try {
      const res = await uploadFile(file);
      setForm((f) => ({ ...f, primary_image_url: res.url }));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Upload ảnh thất bại');
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      await api.post('/products', {
        sku: form.sku,
        name: form.name,
        category_id: form.category_id,
        cost_price: Number(form.cost_price),
        retail_price: Number(form.retail_price),
        ...(form.primary_image_url ? { primary_image_url: form.primary_image_url } : {}),
      });
      onCreated();
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Không thể tạo sản phẩm');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={onClose} />
      <Card className="relative z-10 w-full max-w-lg">
        <CardBody>
          <h2 className="mb-4 text-lg font-semibold text-ink-900">Thêm sản phẩm</h2>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="sku">SKU</Label>
                <Input id="sku" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="name">Tên</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
            </div>
            <div>
              <Label htmlFor="cat">Danh mục</Label>
              <select
                id="cat"
                className="h-10 w-full rounded-xl border border-ink-200 bg-white/[0.85] px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                required
              >
                <option value="">Chọn danh mục</option>
                {cats?.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="cost">Giá vốn (VND)</Label>
                <Input
                  id="cost"
                  type="number"
                  min="0"
                  value={form.cost_price}
                  onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="retail">Giá bán (VND)</Label>
                <Input
                  id="retail"
                  type="number"
                  min="1"
                  value={form.retail_price}
                  onChange={(e) => setForm({ ...form, retail_price: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="img">Ảnh đại diện</Label>
              <input
                id="img"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onFile}
                className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-brand-700"
              />
              {uploading && <p className="mt-1 text-xs text-ink-400">Đang tải ảnh...</p>}
              {form.primary_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.primary_image_url} alt="preview" className="mt-2 h-20 w-20 rounded-lg object-cover" />
              )}
            </div>
            {err && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" type="button" onClick={onClose}>
                Hủy
              </Button>
              <Button type="submit" loading={saving || uploading}>
                Tạo
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
