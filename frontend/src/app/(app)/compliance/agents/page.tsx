'use client';

import { Badge, Card, CardBody, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui';
import { agentMeta } from '@/lib/agents';
import { useApi } from '@/lib/use-api';
import { formatNumber } from '@/lib/utils';

interface AgentPermission {
  agentType: string;
  source: 'db' | 'default';
  maximumRiskLevel: number;
  allowedActions: string[];
  approvalRequiredActions: string[];
  deniedActions: string[];
  autoPublishAllowed: boolean;
  maximumDiscountPercent: number;
  maximumOrderValue: number;
  maximumAdBudget: number;
  maximumMessageBatch: number;
}

function ChipGroup({
  label,
  items,
  className,
}: {
  label: string;
  items: string[];
  className: string;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">{label}</p>
      {items.length === 0 ? (
        <span className="text-sm text-ink-400">—</span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((a) => (
            <span key={a} className={`rounded-full px-2.5 py-1 text-xs ${className}`}>
              {a}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AgentPermissionMatrixPage() {
  const { data, loading, error, reload } = useApi<{ data: AgentPermission[] }>('/compliance/agent-permissions');

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI Governance"
        title="Phân quyền Agent"
        description="Ma trận least-privilege: mỗi agent chỉ được làm đúng phạm vi, phần còn lại cần phê duyệt hoặc bị cấm."
      />

      {loading ? (
        <Card>
          <LoadingState />
        </Card>
      ) : error ? (
        <Card>
          <ErrorState message={error} onRetry={reload} />
        </Card>
      ) : !data || data.data.length === 0 ? (
        <Card>
          <EmptyState title="Chưa có phân quyền agent" hint="Chưa cấu hình ma trận phân quyền nào." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {data.data.map((p) => {
            const meta = agentMeta(p.agentType);
            const Icon = meta.icon;
            return (
              <Card key={p.agentType} className="h-full">
                <CardBody className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink-900">{meta.name}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge tone="pending">Rủi ro tối đa: {p.maximumRiskLevel}</Badge>
                        {p.source === 'db' ? (
                          <Badge tone="completed">Tuỳ chỉnh</Badge>
                        ) : (
                          <Badge tone="pending">Mặc định</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <ChipGroup label="Được phép" items={p.allowedActions} className="bg-brand-50 text-brand-700" />
                    <ChipGroup label="Cần duyệt" items={p.approvalRequiredActions} className="bg-amber-50 text-amber-700" />
                    <ChipGroup label="Bị cấm" items={p.deniedActions} className="bg-rose-50 text-rose-700" />
                  </div>

                  <p className="border-t border-ink-100 pt-3 text-xs text-ink-500">
                    Auto-publish: {p.autoPublishAllowed ? 'Bật' : 'Tắt'} · Giảm giá tối đa {p.maximumDiscountPercent}% · Đơn tối đa{' '}
                    {formatNumber(p.maximumOrderValue)}đ
                  </p>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
