import type { WIEntry } from '../types';
import { POSITION, SELECTIVE_LOGIC } from '../lib/lorebook';

export type Strategy = 'constant' | 'normal' | 'vectorized';

export const STRATEGY_INFO: Record<Strategy, { icon: string; label: string; help: string }> = {
  normal: { icon: '🟢', label: '關鍵詞觸發', help: '對話中出現關鍵詞時才插入' },
  constant: { icon: '🔵', label: '常駐', help: '永遠插入，不看關鍵詞' },
  vectorized: { icon: '🔗', label: '向量檢索', help: '需要 SillyTavern 的 Vector Storage 擴充功能' },
};

export function strategyOf(entry: WIEntry): Strategy {
  if (entry.constant) return 'constant';
  if (entry.vectorized) return 'vectorized';
  return 'normal';
}

export function strategyPatch(strategy: Strategy): Partial<WIEntry> {
  return { constant: strategy === 'constant', vectorized: strategy === 'vectorized' };
}

export const POSITION_OPTIONS = [
  { value: POSITION.before, label: '↑Char 角色定義之前', short: '↑Char' },
  { value: POSITION.after, label: '↓Char 角色定義之後', short: '↓Char' },
  { value: POSITION.EMTop, label: '↑EM 對話範例之前', short: '↑EM' },
  { value: POSITION.EMBottom, label: '↓EM 對話範例之後', short: '↓EM' },
  { value: POSITION.ANTop, label: '↑AN 作者註釋之前', short: '↑AN' },
  { value: POSITION.ANBottom, label: '↓AN 作者註釋之後', short: '↓AN' },
  { value: POSITION.atDepth, label: '@D 指定深度', short: '@D' },
  { value: POSITION.outlet, label: 'Outlet 出口（巨集引用）', short: 'Outlet' },
];

export function positionShortLabel(entry: WIEntry): string {
  const option = POSITION_OPTIONS.find((o) => o.value === entry.position);
  if (!option) return `位置 ${entry.position}`;
  return entry.position === POSITION.atDepth ? `@D${entry.depth}` : option.short;
}

export const ROLE_OPTIONS = [
  { value: 0, label: '⚙️ 系統 System' },
  { value: 1, label: '👤 使用者 User' },
  { value: 2, label: '🤖 助理 Assistant' },
];

export const LOGIC_OPTIONS = [
  { value: SELECTIVE_LOGIC.AND_ANY, label: 'AND ANY：含任一個' },
  { value: SELECTIVE_LOGIC.AND_ALL, label: 'AND ALL：全部都要有' },
  { value: SELECTIVE_LOGIC.NOT_ANY, label: 'NOT ANY：一個都不能有' },
  { value: SELECTIVE_LOGIC.NOT_ALL, label: 'NOT ALL：不能全部都有' },
];
