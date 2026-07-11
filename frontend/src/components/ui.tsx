'use client';

import { cn } from '@/lib/utils';
import { AlertCircle, ArrowRight, Inbox, Loader2 } from 'lucide-react';
import * as React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
};

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const variants = {
    primary: 'bg-ink-900 text-white shadow-[0_10px_24px_rgba(18,24,21,.18)] hover:bg-brand-800',
    secondary: 'border border-ink-200 bg-white/80 text-ink-800 hover:border-brand-300 hover:bg-brand-50',
    ghost: 'bg-transparent text-ink-600 hover:bg-ink-100 hover:text-ink-900',
    danger: 'bg-signal-rose text-white hover:bg-rose-700',
  };
  const sizes = { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4 text-sm' };
  return (
    <button
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-semibold transition duration-200 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-white/70 bg-white/[0.82] shadow-card ring-1 ring-ink-900/[0.03] backdrop-blur',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('p-5 sm:p-6', className)}>{children}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[1.75rem] border border-ink-900/10 bg-ink-900 px-5 py-6 text-white shadow-panel sm:px-7',
        className,
      )}
    >
      <div className="absolute inset-0 bg-grid bg-[length:28px_28px] opacity-35" />
      <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand-400/25 blur-3xl" />
      <div className="absolute bottom-0 right-16 h-20 w-40 rounded-full bg-signal-amber/20 blur-2xl" />
      <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          {eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand-200">{eyebrow}</p>}
          <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-100/82">{description}</p>}
        </div>
        {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
      </div>
    </div>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = 'brand',
  className,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  tone?: 'brand' | 'amber' | 'blue' | 'rose';
  className?: string;
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-sky-50 text-sky-700',
    rose: 'bg-rose-50 text-rose-700',
  };
  return (
    <Card className={cn('group overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:shadow-panel', className)}>
      <CardBody className="flex min-h-[122px] items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink-500">{label}</p>
          <p className="number mt-2 truncate text-2xl font-semibold tracking-tight text-ink-950">{value}</p>
          {sub && <p className="mt-1 truncate text-xs text-ink-400">{sub}</p>}
        </div>
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </CardBody>
    </Card>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-xl border border-ink-200 bg-white/[0.85] px-3 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-ink-700">
      {children}
    </label>
  );
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-brand-100 text-brand-800 ring-brand-200',
  completed: 'bg-brand-100 text-brand-800 ring-brand-200',
  delivered: 'bg-brand-100 text-brand-800 ring-brand-200',
  paid: 'bg-brand-100 text-brand-800 ring-brand-200',
  shipped: 'bg-sky-100 text-sky-800 ring-sky-200',
  confirmed: 'bg-sky-100 text-sky-800 ring-sky-200',
  pending: 'bg-amber-100 text-amber-800 ring-amber-200',
  unpaid: 'bg-amber-100 text-amber-800 ring-amber-200',
  cancelled: 'bg-rose-100 text-rose-800 ring-rose-200',
  returned: 'bg-rose-100 text-rose-800 ring-rose-200',
  archived: 'bg-ink-100 text-ink-600 ring-ink-200',
  HIGH: 'bg-brand-100 text-brand-800 ring-brand-200',
  MEDIUM: 'bg-amber-100 text-amber-800 ring-amber-200',
  LOW: 'bg-rose-100 text-rose-800 ring-rose-200',
};

export function Badge({ children, tone }: { children: React.ReactNode; tone?: string }) {
  const style = (tone && STATUS_STYLES[tone]) || 'bg-ink-100 text-ink-700 ring-ink-200';
  return (
    <span className={cn('inline-flex items-center rounded-lg px-2 py-1 text-xs font-semibold capitalize ring-1', style)}>
      {children}
    </span>
  );
}

export function TableWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('overflow-x-auto rounded-2xl border border-ink-100 bg-white/55', className)}>{children}</div>;
}

export function LoadingState({ label = 'Đang tải dữ liệu' }: { label?: string }) {
  return (
    <div className="space-y-3 p-6">
      <div className="flex items-center gap-3 text-sm font-medium text-ink-500">
        <span className="h-2 w-2 rounded-full bg-brand-500" />
        {label}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    </div>
  );
}

export function EmptyState({ title = 'Chưa có dữ liệu', hint }: { title?: string; hint?: string }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-100 text-ink-500">
        <Inbox className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-semibold text-ink-800">{title}</p>
        {hint && <p className="mt-1 max-w-sm text-xs leading-5 text-ink-500">{hint}</p>}
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
        <AlertCircle className="h-6 w-6" />
      </div>
      <p className="max-w-md text-sm leading-6 text-ink-600">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Thử lại <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-ink-100/80', className)} />;
}
