// 优先级令牌：Morandi 低饱和色 + 标签，供列表/详情/日历/筛选统一使用
export const PRIORITY_COLORS = {
  1: '#b0574f', // 紧急 — 哑光砖红
  2: '#c08a5e', // 高   — 暖陶土
  3: '#6f8fb0', // 中   — 雾霭蓝
  4: '#7d857c', // 低   — 灰鼠尾草
};

export const PRIORITY_LABELS = { 1: 'P1', 2: 'P2', 3: 'P3', 4: 'P4' };
export const PRIORITY_NAMES = { 1: '紧急', 2: '高', 3: '中', 4: '低' };

export const PRIORITY_FALLBACK = PRIORITY_COLORS[4];

export function priorityColor(p) {
  return PRIORITY_COLORS[p] || PRIORITY_FALLBACK;
}
