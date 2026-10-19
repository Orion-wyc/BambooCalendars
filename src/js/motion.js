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

// 在"持久容器"上重放一次性入场：先移除类、强制回流、再加回。
// el 为常驻元素（如 #task-list-area / #list-header / #detail-panel），
// 其子内容虽被重建，动画类挂在容器上，只在此调用时播放一次。
export function flashEnter(el, cls = 'anim-in') {
  if (!el || !el.classList) return;
  if (prefersReduced()) { el.classList.remove(cls); return; }
  el.classList.remove(cls);
  // 读取 offsetWidth 触发回流，确保同名 animation 重新开始
  void el.offsetWidth;
  el.classList.add(cls);
}

// 动画结束后清理一次性类，保持 DOM 干净、便于下次重放。
export function clearClassAfterAnim(el, cls = 'anim-in') {
  if (!el || typeof el.addEventListener !== 'function') return;
  const done = (e) => {
    if (e && e.target && e.target !== el) return; // 只认容器自身的动画结束
    el.classList.remove(cls);
    el.removeEventListener('animationend', done);
  };
  el.addEventListener('animationend', done);
  // 兜底：极端情况下 animationend 不触发时定时清除
  if (typeof setTimeout === 'function') {
    setTimeout(() => { el.classList.remove(cls); }, 600);
  }
}
