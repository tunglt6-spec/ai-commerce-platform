'use client';

import { Badge, Card, EmptyState, ErrorState, LoadingState, PageHeader, TableWrap } from '@/components/ui';
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
      <PageHeader
        eyebrow="Access Control"
        title="Người dùng & phân quyền"
        description="Quản lý thành viên và phân quyền theo vai trò trong cửa hàng của bạn."
      />

      {msg &&
        (msg === 'Đã cập nhật quyền.' ? (
          <div className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-700">{msg}</div>
        ) : (
          <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{msg}</div>
        ))}

      <Card>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : data!.data.length === 0 ? (
          <EmptyState title="Chưa có thành viên" />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left">
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Thành viên</th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Email</th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Quyền</th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {data!.data.map((m) => (
                  <tr
                    key={m.user_id}
                    className="border-b border-ink-100/70 last:border-0 hover:bg-brand-50/50"
                  >
                    <td className="px-5 py-3.5 font-medium text-ink-900">
                      {[m.first_name, m.last_name].filter(Boolean).join(' ') || m.username}
                    </td>
                    <td className="px-5 py-3.5 text-ink-600">{m.email}</td>
                    <td className="px-5 py-3.5">
                      {canAdmin ? (
                        <select
                          className="h-9 rounded-xl border border-ink-200 bg-white/85 px-2 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
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
                    <td className="px-5 py-3.5">
                      <Badge tone={m.is_active ? 'active' : 'archived'}>
                        {m.is_active ? 'active' : 'inactive'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
      {!canAdmin && (
        <p className="text-xs text-ink-400">Chỉ Admin mới đổi được quyền thành viên.</p>
      )}
    </div>
  );
}
