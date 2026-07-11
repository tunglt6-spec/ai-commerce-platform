'use client';

import { Button, Card, CardBody, Input, Label, LoadingState, PageHeader } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { usePermissions } from '@/lib/roles';
import { useApi } from '@/lib/use-api';
import { Check, CheckCircle2, ChevronLeft, ChevronRight, Sparkles, Store, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const STEPS = [
  { n: 1, label: 'Cửa hàng' },
  { n: 2, label: 'AI Provider' },
  { n: 3, label: 'Sản phẩm đầu tiên' },
];

export default function OnboardingPage() {
  const { canManage, canOperate } = usePermissions();
  const [step, setStep] = useState(1);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Getting Started"
        title="Thiết lập cửa hàng"
        description="Ba bước để đưa cửa hàng vào vận hành: hồ sơ thương hiệu, bật AI và tạo sản phẩm đầu tiên."
      />

      {/* Stepper */}
      <div className="flex flex-wrap items-center gap-3">
        {STEPS.map((s, i) => (
          <div key={s.n} className="flex items-center gap-3">
            <button
              onClick={() => setStep(s.n)}
              className={
                'flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-sm font-semibold transition ' +
                (step === s.n
                  ? 'border-transparent bg-ink-900 text-white'
                  : step > s.n
                    ? 'border-brand-200 bg-brand-50 text-brand-700'
                    : 'border-ink-200 bg-white text-ink-500')
              }
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs">
                {step > s.n ? <Check className="h-3.5 w-3.5" /> : s.n}
              </span>
              {s.label}
            </button>
            {i < STEPS.length - 1 && <div className="hidden h-px w-8 bg-ink-200 sm:block" />}
          </div>
        ))}
      </div>

      {step === 1 && <StoreStep canManage={canManage} onNext={() => setStep(2)} />}
      {step === 2 && <AiStep onBack={() => setStep(1)} onNext={() => setStep(3)} />}
      {step === 3 && <ProductStep canOperate={canOperate} onBack={() => setStep(2)} />}
    </div>
  );
}

function StoreStep({ canManage, onNext }: { canManage: boolean; onNext: () => void }) {
  const { data, loading } = useApi<{ data: { name: string; description?: string; slug: string } }>('/tenant/me');
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (data?.data) setForm({ name: data.data.name ?? '', description: data.data.description ?? '' });
  }, [data]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await api.patch('/tenant/me', { name: form.name, description: form.description });
      setMsg('Đã lưu hồ sơ cửa hàng.');
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Card><LoadingState /></Card>;

  return (
    <Card className="max-w-2xl">
      <CardBody>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-ink-950">Hồ sơ cửa hàng</h2>
            <p className="text-sm text-ink-500">Tên và mô tả hiển thị cho thương hiệu của bạn.</p>
          </div>
        </div>
        <form onSubmit={save} className="space-y-4">
          <div>
            <Label htmlFor="name">Tên cửa hàng</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!canManage} required />
          </div>
          <div>
            <Label htmlFor="desc">Mô tả</Label>
            <textarea
              id="desc"
              className="min-h-[90px] w-full rounded-xl border border-ink-200 bg-white/85 p-3 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              disabled={!canManage}
              placeholder="Ví dụ: Cửa hàng phụ kiện thể thao pickleball chính hãng."
            />
          </div>
          {!canManage && <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Cần quyền Manager để chỉnh hồ sơ cửa hàng.</p>}
          {msg && <div className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-700">{msg}</div>}
          <div className="flex items-center justify-between">
            <Button type="submit" variant="secondary" loading={saving} disabled={!canManage}>
              Lưu
            </Button>
            <Button type="button" onClick={onNext}>
              Tiếp tục <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function AiStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { data, loading } = useApi<{ data: { configured: boolean } }>('/ai/status');
  const configured = data?.data?.configured;

  return (
    <Card className="max-w-2xl">
      <CardBody>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-ink-950">AI Provider</h2>
            <p className="text-sm text-ink-500">Kết nối nhà cung cấp AI để bật sinh nội dung, chấm điểm và tư vấn.</p>
          </div>
        </div>

        {loading ? (
          <LoadingState />
        ) : configured ? (
          <div className="flex items-center gap-3 rounded-2xl bg-brand-50 px-4 py-4 text-sm text-brand-800">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>AI provider đã được cấu hình. Các agent AI sẽ tạo nội dung thật thay vì bản mẫu.</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-4 text-sm text-amber-800">
              <XCircle className="h-5 w-5 shrink-0" />
              <span>Chưa cấu hình AI provider. Các agent vẫn hoạt động ở chế độ mẫu (không bịa dữ liệu).</span>
            </div>
            <div className="rounded-2xl border border-ink-100 bg-ink-50/60 p-4 text-sm leading-6 text-ink-600">
              Để bật AI, quản trị hạ tầng đặt các biến môi trường <code className="rounded bg-ink-100 px-1">AI_GATEWAY_BASE_URL</code> và{' '}
              <code className="rounded bg-ink-100 px-1">AI_GATEWAY_API_KEY</code> (ví dụ OpenRouter) trên máy chủ rồi khởi động lại API. Khoá không nhập
              qua giao diện để bảo mật.
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between">
          <Button type="button" variant="secondary" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" /> Quay lại
          </Button>
          <Button type="button" onClick={onNext}>
            Tiếp tục <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function ProductStep({ canOperate, onBack }: { canOperate: boolean; onBack: () => void }) {
  const [form, setForm] = useState({ category_name: '', sku: '', name: '', cost_price: '', retail_price: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const cat = await api.post('/categories', { name: form.category_name });
      await api.post('/products', {
        sku: form.sku,
        name: form.name,
        category_id: cat.data.id,
        cost_price: Number(form.cost_price),
        retail_price: Number(form.retail_price),
      });
      setDone(true);
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Không thể tạo sản phẩm');
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <Card className="max-w-2xl">
        <CardBody className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-ink-950">Cửa hàng đã sẵn sàng!</h2>
            <p className="mt-1 text-sm text-ink-500">Sản phẩm đầu tiên đã được tạo và tự động chấm điểm.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/products">
              <Button variant="secondary">Xem sản phẩm</Button>
            </Link>
            <Link href="/dashboard">
              <Button>Vào Tổng quan</Button>
            </Link>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl">
      <CardBody>
        <h2 className="mb-1 text-lg font-semibold text-ink-950">Sản phẩm đầu tiên</h2>
        <p className="mb-4 text-sm text-ink-500">Tạo một danh mục và sản phẩm để bắt đầu — AI sẽ tự chấm điểm.</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="cat">Danh mục</Label>
            <Input id="cat" value={form.category_name} onChange={(e) => setForm({ ...form, category_name: e.target.value })} placeholder="Ví dụ: Vợt pickleball" disabled={!canOperate} required />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="sku">Mã SKU</Label>
              <Input id="sku" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="PKL-001" disabled={!canOperate} required />
            </div>
            <div>
              <Label htmlFor="pname">Tên sản phẩm</Label>
              <Input id="pname" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Vợt pickleball Pro" disabled={!canOperate} required />
            </div>
            <div>
              <Label htmlFor="cost">Giá vốn (VND)</Label>
              <Input id="cost" type="number" min="0" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} disabled={!canOperate} required />
            </div>
            <div>
              <Label htmlFor="retail">Giá bán (VND)</Label>
              <Input id="retail" type="number" min="0" value={form.retail_price} onChange={(e) => setForm({ ...form, retail_price: e.target.value })} disabled={!canOperate} required />
            </div>
          </div>
          {!canOperate && <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Cần quyền Operator trở lên để tạo sản phẩm.</p>}
          {msg && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{msg}</div>}
          <div className="flex items-center justify-between">
            <Button type="button" variant="secondary" onClick={onBack}>
              <ChevronLeft className="h-4 w-4" /> Quay lại
            </Button>
            <Button type="submit" loading={saving} disabled={!canOperate}>
              Tạo & hoàn tất
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
