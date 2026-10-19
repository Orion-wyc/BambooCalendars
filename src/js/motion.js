// 动效工具：为"整段 innerHTML 重建"的渲染架构提供可重复触发的一次性入场动画。
// 原则：CSS transition 只在同一元素属性变化时生效，重建后不触发；改用 animation
// + 一次性 class（靠 reflow 重放），并遵循 prefers-reduced-motion。

export function prefersReduced() {
  try {
    return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

// 每个常驻元素至多存在一次"待收尾"的入场动画。用 WeakMap 记录其 animationend
// 监听器与兜底定时器，重触发时先撤销上一次，杜绝监听器/定时器堆积与旧定时器截断新动画。
const pending = new WeakMap();

function cancelPending(el) {
  const state = pending.get(el);
  if (!state) return;
  if (state.timer != null) clearTimeout(state.timer);
  if (state.handler) el.removeEventListener('animationend', state.handler);
  pending.delete(el);
}

// 在"持久容器"上重放一次性入场：先撤销上一次挂起清理、移除类、强制回流、再加回。
// el 为常驻元素（如 #task-list-area / #list-header / #detail-panel），其子内容虽被
// 重建，动画类挂在容器上，只在此调用时播放一次。
export function flashEnter(el, cls = 'anim-in') {
  if (!el || !el.classList) return;
  cancelPending(el);
  if (prefersReduced()) { el.classList.remove(cls); return; }
  el.classList.remove(cls);
  // 读取 offsetWidth 触发回流，确保同名 animation 重新开始
  void el.offsetWidth;
  el.classList.add(cls);
}

// 入场结束后清理一次性类与相关监听/定时器，保持 DOM 干净、避免泄漏。
// 说明：动画可能挂在容器自身（#task-list-area / #list-header），也可能挂在子元素
// （#detail-panel 的 .detail-header/.detail-content）。后者的 animationend 的 target
// 恒为子元素，不能据此收尾——因此监听分支只处理容器自身动画，子动画统一交由兜底
// timeout 收尾；两种情况都会移除监听器，绝不残留。timeoutMs 需 >= 动画时长+最大错峰。
export function clearClassAfterAnim(el, cls = 'anim-in', timeoutMs = 600) {
  if (!el || typeof el.addEventListener !== 'function') return;
  cancelPending(el);
  // reduced 模式下 flashEnter 不加类、不会有动画，这里也无需注册任何监听/定时器，
  // 否则 animationend 永不触发会使监听器永久残留。
  if (prefersReduced()) { el.classList.remove(cls); return; }

  const state = { handler: null, timer: null };
  const finish = () => {
    if (state.timer != null) clearTimeout(state.timer);
    el.removeEventListener('animationend', state.handler);
    el.classList.remove(cls);
    pending.delete(el);
  };
  state.handler = (e) => {
    // 仅容器自身动画结束才提前收尾；子元素动画交由兜底 timeout 统一收尾
    if (e && e.target && e.target !== el) return;
    finish();
  };
  el.addEventListener('animationend', state.handler);
  state.timer = setTimeout(finish, timeoutMs);
  pending.set(el, state);
}
