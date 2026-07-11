'use client';

import { Badge, Button, Card, CardBody, ErrorState, Input, Label, LoadingState, PageHeader } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { usePermissions } from '@/lib/roles';
import { Plug } from 'lucide-react';
import { useState } from 'react';

const STATUS_TONE: Record<string, string> = {
  connected: 'completed',
  connecting: 'pending',
  not_configured: 'archived',
  disabled: 'archived',
  expired: 'pending',
  error: 'cancelled',
};

export default function IntegrationsPage() {
  const { data, loading, error, reload } = useApi<{ data: any[] }>('/integrations');
  const { canAdmin } = usePermissions();
  const [connecting, setConnecting] = useState<string | null>(null);
  const [modal, setModal] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const disconnect = async (provider: string) => {
    if (!window.confirm(`Ngắt kết nối ${provider}? Thông tin xác thực sẽ bị xoá.`)) return;
    setConnecting(provider);
    setMsg(null);
    try {
      await api.post(`/integrations/${provider}/disconnect`);
      reload();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Ngắt kết nối thất bại');
    } finally {
      setConnecting(null);
    }
  };

  const test = async (provider: string) => {
    setConnecting(provider);
    setMsg(null);
    try {
      const res = await api.post(`/integrations/${provider}/test`);
      setMsg(`Test ${provider}: ${res.data.status}${res.data.last_error ? ' - ' + res.data.last_error : ''}`);
      reload();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Test thất bại');
    } finally {
      setConnecting(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Integrations"
        title="Tích hợp"
        description="Kết nối kênh bán, thanh toán và vận chuyển với bảo mật khoá được mã hoá."
      />

      {msg && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{msg}</div>}

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data!.data.map((it) => (
            <Card key={it.provider}>
              <CardBody>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-100 text-ink-600">
                      <Plug className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink-950">{it.label}</p>
                      <p className="text-xs capitalize text-ink-500">{it.kind}</p>
                    </div>
                  </div>
                  <Badge tone={STATUS_TONE[it.status]}>{it.status.replace('_', ' ')}</Badge>
                </div>
                {it.last_error && <p className="mb-2 text-xs text-rose-600">{it.last_error}</p>}
                {!canAdmin ? (
                  <p className="text-xs text-ink-500">Chỉ Admin mới cấu hình tích hợp.</p>
                ) : (
                <div className="flex gap-2">
                  {it.status === 'connected' || it.status === 'error' || it.status === 'disabled' ? (
                    <>
                      {it.verify_url && (
                        <Button variant="secondary" size="sm" loading={connecting === it.provider} onClick={() => test(it.provider)}>
                          Test
                        </Button>
                      )}
                      {it.status !== 'disabled' ? (
                        <Button variant="ghost" size="sm" loading={connecting === it.provider} onClick={() => disconnect(it.provider)}>
                          Ngắt
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => setModal(it.provider)}>
                          Kết nối lại
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button size="sm" onClick={() => setModal(it.provider)}>
                      Kết nối
                    </Button>
                  )}
                </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {modal && (
        <ConnectModal
          provider={modal}
          onClose={() => setModal(null)}
          onConnected={() => {
            setModal(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function ConnectModal({ provider, onClose, onConnected }: { provider: string; onClose: () => void; onConnected: () => void }) {
  const [apiKey, setApiKey] = useState('');
  const [verifyUrl, setVerifyUrl] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      const config: Record<string, string> = {};
      if (verifyUrl) config.verify_url = verifyUrl;
      if (webhookUrl) config.webhook_url = webhookUrl;
      await api.post(`/integrations/${provider}/connect`, { api_key: apiKey, config });
      onConnected();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Kết nối thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={onClose} />
      <Card className="relative z-10 w-full max-w-lg">
        <CardBody>
          <h2 className="mb-1 text-lg font-semibold capitalize text-ink-950">Kết nối {provider}</h2>
          <p className="mb-4 text-sm text-ink-500">
            Khoá API được lưu dưới dạng tham chiếu không thể đảo ngược — không hiển thị lại và không ghi vào log.
          </p>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label htmlFor="key">API Key / Access Token</Label>
              <Input id="key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="vu">Verify URL (tuỳ chọn)</Label>
              <Input id="vu" placeholder="https://api.provider.com/ping" value={verifyUrl} onChange={(e) => setVerifyUrl(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="wu">Webhook URL (tuỳ chọn)</Label>
              <Input id="wu" placeholder="https://your-endpoint/webhook" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} />
            </div>
            {err && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Hủy
              </Button>
              <Button type="submit" loading={saving}>
                Kết nối
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
