export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  read: boolean;
  data?: Record<string, unknown> | null;
  created_at: string;
  local?: boolean;
}

type CountListener = (count: number) => void;
type ListListener = (items: AppNotification[]) => void;

let _items: AppNotification[] = [];
const _countListeners = new Set<CountListener>();
const _listListeners = new Set<ListListener>();

function unreadCount() {
  return _items.filter(n => !n.read).length;
}

function broadcast() {
  const count = unreadCount();
  _countListeners.forEach(l => l(count));
  _listListeners.forEach(l => l([..._items]));
}

export function pushNotification(n: AppNotification) {
  if (_items.some(x => x.id === n.id)) return;
  _items = [n, ..._items].slice(0, 100);
  broadcast();
}

export function pushLocalNotification(type: string, title: string, body?: string, data?: Record<string, unknown>) {
  pushNotification({
    id: `local-${Date.now()}-${Math.random()}`,
    type, title, body,
    read: false, data,
    created_at: new Date().toISOString(),
    local: true,
  });
}

export function setNotifications(items: AppNotification[]) {
  _items = items.slice(0, 100);
  broadcast();
}

export function markAllRead() {
  _items = _items.map(n => ({ ...n, read: true }));
  broadcast();
}

export function removeNotification(id: string) {
  _items = _items.filter(n => n.id !== id);
  broadcast();
}

export function clearAllNotifications() {
  _items = [];
  broadcast();
}

// Legacy compat
export function incrementNotif() {
  pushLocalNotification("SYSTEM", "New activity");
}
export function clearNotif() { markAllRead(); }

export function subscribeNotif(fn: CountListener) {
  _countListeners.add(fn);
  fn(unreadCount());
  return () => { _countListeners.delete(fn); };
}

export function subscribeNotifList(fn: ListListener) {
  _listListeners.add(fn);
  fn([..._items]);
  return () => { _listListeners.delete(fn); };
}
