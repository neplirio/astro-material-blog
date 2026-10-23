const preference = matchMedia('(prefers-reduced-motion: reduce)');
const running = new Map<HTMLElement, Animation>();
export function cancelMotion(element: HTMLElement) {
  running.get(element)?.cancel();
  running.delete(element);
}
export function revealCard(element: HTMLElement, index: number) {
  cancelMotion(element);
  if (preference.matches || typeof element.animate !== 'function') return;
  const animation = element.animate(
    [{ opacity: 0.25, translate: '0 10px' }, { opacity: 1, translate: '0 0' }],
    { duration: 240, delay: Math.min(index, 5) * 28, easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: 'backwards' },
  );
  animation.id = 'glonee-filter-reveal';
  running.set(element, animation);
  animation.finished.then(() => { if (running.get(element) === animation) running.delete(element); }, () => {});
}
// CSS media queries cannot stop WAAPI effects. Honor a preference change immediately too.
function cancelAll() { running.forEach(animation => animation.cancel()); running.clear(); }
preference.addEventListener('change', () => { if (preference.matches) cancelAll(); });
window.addEventListener('pagehide', cancelAll);
