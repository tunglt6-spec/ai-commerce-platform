'use client';

import { Badge, Card, CardBody, ErrorState, LoadingState, PageHeader, StatCard } from '@/components/ui';
import { useApi } from '@/lib/use-api';
import { formatNumber } from '@/lib/utils';
import { AlertTriangle, ClipboardCheck, FileText, Gavel, Image as ImageIcon, PackageCheck, Radio, ShieldAlert, ShieldCheck, Siren, UserCheck } from 'lucide-react';
import Link from 'next/link';

interface Metrics {
  kpis: {
    active_policies: number;
    policies_overdue_review: number;
    actions_blocked: number;
    pending_approvals: number;
    incidents: number;
    assets_pending_rights: number;
    products_pending_compliance: number;
    consent_withdrawals: number;
    platform_packs_outdated: number;
    high_risk_actions: number;
  };
  decisions_by_type: { decision: string; count: number }[];
}

const LINKS = [
  { href: '/compliance/approvals', label: 'Phê duyệt', desc: 'Hàng đợi phê duyệt hành động', icon: ClipboardCheck },
  { href: '/compliance/policies', label: 'Chính sách', desc: 'Policy registry & versioning', icon: FileText },
  { href: '/compliance/agents', label: 'Phân quyền Agent', desc: 'Least-privilege matrix', icon: UserCheck },
  { href: '/compliance/proposals', label: 'Đề xuất hành động', desc: 'Agent action proposals', icon: Gavel },
  { href: '/compliance/kill-switches', label: 'Kill switch', desc: 'Dừng khẩn cấp hành động', icon: Siren },
  { href: '/compliance/platform-packs', label: 'Platform packs', desc: 'Chính sách nền tảng', icon: Radio },
  { href: '/compliance/product-compliance', label: 'Tuân thủ sản phẩm', desc: 'Sell/advertise permission', icon: PackageCheck },
  { href: '/compliance/consent', label: 'Consent', desc: 'Cơ sở liên hệ khách hàng', icon: ShieldCheck },
  { href: '/compliance/assets', label: 'Quyền tài sản', desc: 'Asset rights registry', icon: ImageIcon },
  { href: '/compliance/incidents', label: 'Sự cố', desc: 'Incident center', icon: AlertTriangle },
  { href: '/compliance/audit', label: 'Audit log', desc: 'Nhật ký bất biến', icon: ShieldAlert },
];

export default function ComplianceDashboard() {
  const { data, loading, error, reload } = useApi<{ data: Metrics }>('/compliance/dashboard/metrics');
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const k = data!.data.kpis;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI Governance"
        title="Tuân thủ & Chính sách AI"
        description="Lớp quản trị thực thi ở runtime: mọi hành động hướng ra ngoài của AI đều qua Policy Guard và Execution Gateway."
      />

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Bộ chính sách mẫu cần <b>chuyên gia pháp chế rà soát</b> trước khi kích hoạt production. Đây không phải tư vấn pháp lý.
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard icon={FileText} label="Chính sách ACTIVE" value={formatNumber(k.active_policies)} />
        <StatCard icon={ClipboardCheck} label="Chờ phê duyệt" value={formatNumber(k.pending_approvals)} tone="amber" />
        <StatCard icon={ShieldAlert} label="Hành động bị chặn" value={formatNumber(k.actions_blocked)} tone="rose" />
        <StatCard icon={Siren} label="Sự cố mở" value={formatNumber(k.incidents)} tone="rose" />
        <StatCard icon={AlertTriangle} label="Hành động rủi ro cao" value={formatNumber(k.high_risk_actions)} tone="amber" />
        <StatCard icon={FileText} label="Policy quá hạn rà soát" value={formatNumber(k.policies_overdue_review)} tone="amber" />
        <StatCard icon={Radio} label="Platform pack hết hạn" value={formatNumber(k.platform_packs_outdated)} tone="amber" />
        <StatCard icon={ImageIcon} label="Tài sản chờ xác minh" value={formatNumber(k.assets_pending_rights)} />
        <StatCard icon={PackageCheck} label="SP chờ duyệt tuân thủ" value={formatNumber(k.products_pending_compliance)} />
        <StatCard icon={ShieldCheck} label="Consent đã rút" value={formatNumber(k.consent_withdrawals)} />
      </div>

      <Card>
        <CardBody>
          <h2 className="mb-4 text-lg font-semibold text-ink-950">Quyết định theo loại</h2>
          {data!.data.decisions_by_type.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-400">Chưa có quyết định nào được ghi nhận.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data!.data.decisions_by_type.map((d) => (
                <Badge key={d.decision} tone={d.decision === 'BLOCK' ? 'cancelled' : d.decision === 'ALLOW' ? 'completed' : 'pending'}>
                  {d.decision}: {formatNumber(d.count)}
                </Badge>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-ink-950">Khu vực quản trị</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {LINKS.map((l) => {
            const Icon = l.icon;
            return (
              <Link key={l.href} href={l.href}>
                <Card className="group h-full transition duration-200 hover:-translate-y-0.5 hover:shadow-panel">
                  <CardBody className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink-900">{l.label}</p>
                      <p className="text-xs text-ink-500">{l.desc}</p>
                    </div>
                  </CardBody>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
