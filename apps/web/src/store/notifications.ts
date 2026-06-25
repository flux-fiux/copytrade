type Listener = (count: number) => void;

let _count = 0;
const _listeners = new Set<Listener>();

export function incrementNotif() {
  _count++;
  _listeners.forEach(l => l(_count));
}

export function clearNotif() {
  _count = 0;
  _listeners.forEach(l => l(0));
}

export function subscribeNotif(fn: Listener) {
  _listeners.add(fn);
  fn(_count);
  return () => { _listeners.delete(fn); };
}
