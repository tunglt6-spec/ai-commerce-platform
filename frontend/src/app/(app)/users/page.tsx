'use client';

import { Badge, Card, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { usePermissions } from '@/lib/roles';
import { useState } from 'react';

interface Member {
  user_id: string;
  role: string;
  email: string;
  username: string;
  first_name?: string;
  last_name?: string;
  is_active: boolean;
}

const ROLES = ['viewer', 'operator', 'manager', 'admin'];

export default function UsersPage() {
  const { canAdmin } = usePermissions();
  const { data, loading, error, reload } = useApi<{ data: Member[] }>('/users');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const changeRole = async (userId: string, role: string) => {
    setBusy(userId);
    setMsg(null);
    try {
      await api.patch(`/users/${userId}/role`, { role });
      setMsg('Đã cập nhật quyền.');
      reload();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Cập nhật quyền thất bại');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Người dùng & phân quyền</h1>
        <p className="text-sm text-gray-500">Thành viên trong cửa hàng của bạn</p>
      </div>

      {msg && <div className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{msg}</div>}

      <Card>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : data!.data.length === 0 ? (
          <EmptyState title="Chưa có thành viên" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
                  <th className="px-5 py-3 font-medium">Thành viên</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Quyền</th>
                  <th className="px-5 py-3 font-medium">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {data!.data.map((m) => (
                  <tr key={m.user_id} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-3 font-medium text-gray-800">
                      {[m.first_name, m.last_name].filter(Boolean).join(' ') || m.username}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{m.email}</td>
                    <td className="px-5 py-3">
                      {canAdmin ? (
                        <select
                          className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm"
                          value={m.role}
                          disabled={busy === m.user_id}
                          onChange={(e) => changeRole(m.user_id, e.target.value)}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Badge>{m.role}</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={m.is_active ? 'active' : 'archived'}>
                        {m.is_active ? 'active' : 'inactive'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {!canAdmin && (
        <p className="text-xs text-gray-400">Chỉ Admin mới đổi được quyền thành viên.</p>
      )}
    </div>
  );
}
