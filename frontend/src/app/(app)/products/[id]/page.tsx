'use client';

import { Badge, Button, Card, CardBody, ErrorState, LoadingState } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { formatVND } from '@/lib/utils';
import { ArrowLeft, Bot, Sparkles, Video } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data, loading, error, reload } = useApi<{ data: any }>(`/products/${id}`);
  const [scoring, setScoring] = useState(false);
  const [content, setContent] = useState<any>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [videoPlan, setVideoPlan] = useState<any>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const p = data!.data;

  const rescore = async () => {
    setScoring(true);
    setActionMsg(null);
    try {
      await api.post(`/ai/products/${id}/score`);
      await reload();
      setActionMsg('Đã chấm điểm lại bằng Product AI.');
    } catch (e) {
      setActionMsg(e instanceof ApiError ? e.message : 'Lỗi chấm điểm');
    } finally {
      setScoring(false);
    }
  };

  const generate = async () => {
    setGenLoading(true);
    setContent(null);
    try {
      const res = await api.post('/ai/content/generate-description', { product_id: id, variations: 3 });
      setContent(res.data);
    } catch (e) {
      setContent({ error: e instanceof ApiError ? e.message : 'Lỗi tạo nội dung' });
    } finally {
      setGenLoading(false);
    }
  };

  const generateVideo = async () => {
    setVideoLoading(true);
    setVideoPlan(null);
    try {
      const res = await api.post('/ai/video/generate', { product_id: id, video_type: 'unboxing', save: true });
      setVideoPlan(res.data.plan);
      setActionMsg('Đã tạo kế hoạch video (lưu vào Marketing dạng nháp).');
    } catch (e) {
      setVideoPlan({ error: e instanceof ApiError ? e.message : 'Lỗi tạo video' });
    } finally {
      setVideoLoading(false);
    }
  };

  const scores = [
    { label: 'Nhu cầu', value: p.demandScore, max: 25 },
    { label: 'Cạnh tranh', value: p.competitionScore, max: 20 },
    { label: 'Lợi nhuận', value: p.profitMarginScore, max: 25 },
    { label: 'Nội dung', value: p.contentViabilityScore, max: 15 },
    { label: 'Rủi ro', value: p.riskScore, max: 15 },
  ];

  return (
    <div className="space-y-6">
      <Link href="/products" className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-700">
        <ArrowLeft className="h-4 w-4" /> Quay lại
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-950">{p.name}</h1>
          <p className="text-sm text-ink-500">
            {p.sku} · {p.category?.name} · <Badge tone={p.status}>{p.status}</Badge>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={rescore} loading={scoring}>
            <Bot className="h-4 w-4" /> Chấm điểm AI
          </Button>
          <Button onClick={generate} loading={genLoading}>
            <Sparkles className="h-4 w-4" /> Tạo mô tả AI
          </Button>
          <Button variant="secondary" onClick={generateVideo} loading={videoLoading}>
            <Video className="h-4 w-4" /> Kế hoạch video
          </Button>
        </div>
      </div>

      {actionMsg && <div className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{actionMsg}</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardBody>
            <h2 className="mb-4 text-base font-semibold text-ink-900">Điểm cơ hội</h2>
            <div className="mb-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-brand-600">{Number(p.productScore).toFixed(0)}</span>
              <span className="text-ink-400">/100</span>
            </div>
            <div className="space-y-3">
              {scores.map((s) => (
                <div key={s.label}>
                  <div className="mb-1 flex justify-between text-xs text-ink-500">
                    <span>{s.label}</span>
                    <span>
                      {Number(s.value).toFixed(1)}/{s.max}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-ink-100">
                    <div
                      className="h-2 rounded-full bg-brand-500"
                      style={{ width: `${Math.min(100, (Number(s.value) / s.max) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-3">
            <h2 className="text-base font-semibold text-ink-900">Giá & tồn kho</h2>
            <div className="flex justify-between text-sm">
              <span className="text-ink-500">Giá vốn</span>
              <span className="font-medium">{formatVND(p.costPrice)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-500">Giá bán</span>
              <span className="font-medium">{formatVND(p.retailPrice)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-500">Số biến thể</span>
              <span className="font-medium">{p.variants?.length ?? 0}</span>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <h2 className="mb-4 text-base font-semibold text-ink-900">Biến thể</h2>
          {(!p.variants || p.variants.length === 0) ? (
            <p className="py-6 text-center text-sm text-ink-400">Chưa có biến thể</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-xs uppercase text-ink-400">
                    <th className="py-2 font-medium">SKU</th>
                    <th className="py-2 font-medium">Size</th>
                    <th className="py-2 font-medium">Màu</th>
                    <th className="py-2 text-right font-medium">Tồn</th>
                  </tr>
                </thead>
                <tbody>
                  {p.variants.map((v: any) => (
                    <tr key={v.id} className="border-b border-ink-50 last:border-0">
                      <td className="py-2.5 text-ink-700">{v.variantSku}</td>
                      <td className="py-2.5 text-ink-600">{v.size ?? '-'}</td>
                      <td className="py-2.5 text-ink-600">{v.color ?? '-'}</td>
                      <td className="py-2.5 text-right font-medium text-ink-950">{v.stockQuantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {content && (
        <Card>
          <CardBody>
            <h2 className="mb-3 text-base font-semibold text-ink-900">Nội dung do Content AI tạo</h2>
            {content.error ? (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{content.error}</div>
            ) : content.provider_configured === false ? (
              <div className="rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-800">
                <p className="font-medium">AI provider chưa được cấu hình</p>
                <p className="mt-1 text-amber-700">{content.note}</p>
              </div>
            ) : content.variations?.length ? (
              <div className="space-y-3">
                {content.variations.map((v: any) => (
                  <div key={v.version} className="rounded-lg border border-ink-100 bg-ink-50/60 p-3 text-sm text-ink-700">
                    <div className="mb-1 text-xs font-medium text-ink-400">Phiên bản {v.version}</div>
                    {v.content}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-500">{content.note ?? 'Không có kết quả.'}</p>
            )}
          </CardBody>
        </Card>
      )}

      {videoPlan && (
        <Card>
          <CardBody>
            <h2 className="mb-3 text-base font-semibold text-ink-900">
              Kế hoạch video {videoPlan.is_template ? '(mẫu)' : '(AI)'}
            </h2>
            {videoPlan.error ? (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{videoPlan.error}</div>
            ) : videoPlan.note && videoPlan.scenes?.length === 0 ? (
              <div className="whitespace-pre-line rounded-lg border border-ink-100 bg-ink-50/60 p-3 text-sm text-ink-700">
                {videoPlan.note}
              </div>
            ) : (
              <div className="space-y-3">
                {videoPlan.note && <p className="text-xs text-amber-600">{videoPlan.note}</p>}
                <div className="space-y-2">
                  {videoPlan.scenes?.map((s: any) => (
                    <div key={s.scene} className="rounded-lg border border-ink-100 p-3 text-sm">
                      <div className="flex justify-between text-xs text-ink-400">
                        <span>Cảnh {s.scene}</span>
                        <span>{s.duration_seconds}s</span>
                      </div>
                      <p className="font-medium text-ink-900">{s.action}</p>
                      <p className="text-ink-600">{s.voiceover}</p>
                    </div>
                  ))}
                </div>
                {videoPlan.shot_list?.length > 0 && (
                  <p className="text-xs text-ink-500">Shot list: {videoPlan.shot_list.join(' · ')}</p>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
