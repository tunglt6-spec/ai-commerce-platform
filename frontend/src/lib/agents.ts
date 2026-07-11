import { Bot, Clapperboard, FileText, Heart, LineChart, MessagesSquare, Sparkles, Star, Truck } from 'lucide-react';

export interface AgentMeta {
  /** Canonical agentName as stored in ai_agent_tasks.agent_name (used for filtering + routing). */
  key: string;
  name: string;
  desc: string;
  icon: any;
}

/** The eight AI agents in the platform, keyed by their canonical backend agentName. */
export const AGENTS: AgentMeta[] = [
  { key: 'trend_hunter_ai', name: 'Trend Hunter AI', desc: 'Phát hiện xu hướng & cơ hội', icon: Sparkles },
  { key: 'product_ai', name: 'Product AI', desc: 'Chấm điểm sản phẩm', icon: Star },
  { key: 'content_ai', name: 'Content AI', desc: 'Mô tả, caption, SEO', icon: FileText },
  { key: 'video_ai', name: 'Video AI', desc: 'Kịch bản & shot list', icon: Clapperboard },
  { key: 'sales_ai', name: 'Sales AI', desc: 'Tư vấn & chốt đơn', icon: MessagesSquare },
  { key: 'fulfillment_ai', name: 'Fulfillment AI', desc: 'Xử lý & giao hàng', icon: Truck },
  { key: 'raving_fan_ai', name: 'Raving Fan AI', desc: 'Chăm sóc sau bán', icon: Heart },
  { key: 'analyze_ai', name: 'Analyze AI', desc: 'Phân tích & tối ưu', icon: LineChart },
];

export function agentMeta(key: string): AgentMeta {
  return AGENTS.find((a) => a.key === key) ?? { key, name: key, desc: 'AI agent', icon: Bot };
}
