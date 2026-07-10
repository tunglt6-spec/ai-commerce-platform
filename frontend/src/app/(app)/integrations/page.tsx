'use client';

import { Badge, Button, Card, CardBody, ErrorState, Input, Label, LoadingState } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';
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
  const [connecting, setConnecting] = useState<string | null>(null);
  const [modal, setModal] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const disconnect = async (provider: string) => {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Tích hợp</h1>
        <p className="text-sm text-gray-500">Kết nối kênh bán, thanh toán & vận chuyển</p>
      </div>

      {msg && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{msg}</div>}

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
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                      <Plug className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{it.label}</p>
                      <p className="text-xs capitalize text-gray-400">{it.kind}</p>
                    </div>
                  </div>
                  <Badge tone={STATUS_TONE[it.status]}>{it.status.replace('_', ' ')}</Badge>
                </div>
                {it.status === 'connected' ? (
                  <Button variant="secondary" size="sm" loading={connecting === it.provider} onClick={() => disconnect(it.provider)}>
                    Ngắt kết nối
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setModal(it.provider)}>
                    Kết nối
                  </Button>
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
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      await api.post(`/integrations/${provider}/connect`, { api_key: apiKey });
      onConnected();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Kết nối thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <Card className="relative z-10 w-full max-w-md">
        <CardBody>
          <h2 className="mb-1 text-lg font-semibold capitalize text-gray-800">Kết nối {provider}</h2>
          <p className="mb-4 text-xs text-gray-500">
            Khoá API được lưu dưới dạng tham chiếu không thể đảo ngược — không hiển thị lại và không ghi vào log.
          </p>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label htmlFor="key">API Key / Access Token</Label>
              <Input id="key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} required />
            </div>
            {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
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
