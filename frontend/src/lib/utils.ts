import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatVND(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const d = new Date(value);
  return d.toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function formatNumber(value: number | string | null | undefined): string {
  return new Intl.NumberFormat('vi-VN').format(Number(value ?? 0));
}
