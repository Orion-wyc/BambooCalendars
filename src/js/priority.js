// 优先级令牌：语义化高辨识度色板（对齐 Tailwind 推荐色），供列表/详情/日历/筛选统一使用
export const PRIORITY_COLORS = {
  1: '#EF4444', // 紧急 — 鲜艳警示红 Alert Red (red-500)
  2: '#F97316', // 高   — 活力橙 Active Orange (orange-500)
  3: '#F59E0B', // 中   — 琥珀黄 Amber Yellow (amber-500)
  4: '#3B82F6', // 低   — 经典天蓝 Classic Blue (blue-500)
};

export const PRIORITY_LABELS = { 1: 'P1', 2: 'P2', 3: 'P3', 4: 'P4' };
export const PRIORITY_NAMES = { 1: '紧急', 2: '高', 3: '中', 4: '低' };

export const PRIORITY_FALLBACK = '#9CA3AF'; // 未标注优先级时的中性灰

export function priorityColor(p) {
  return PRIORITY_COLORS[p] || PRIORITY_FALLBACK;
}
