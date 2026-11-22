import { AtSign, Bell, CheckCheck, Heart, X } from 'lucide-react';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { relativeTime } from '@/lib/stocks';

export function NotificationInbox({ isAuthenticated, onLogin }: { isAuthenticated: boolean; onLogin: () => void }) {
  const [open, setOpen] = useState(false);
  const notifications = trpc.notifications.list.useQuery(undefined, { enabled: isAuthenticated, refetchInterval: 30_000 });
  const markRead = trpc.notifications.markRead.useMutation({ onSuccess: () => void notifications.refetch() });
  const markAllRead = trpc.notifications.markAllRead.useMutation({ onSuccess: () => void notifications.refetch() });
  function toggle() { if (!isAuthenticated) { onLogin(); return; } setOpen(value => !value); }
  return <div className="notification-inbox">
    <button className={`notification-bell ${notifications.data?.unreadCount ? 'has-unread' : ''}`} onClick={toggle} aria-label="알림 열기"><Bell size={19} fill={notifications.data?.unreadCount ? 'currentColor' : 'none'} />{Boolean(notifications.data?.unreadCount) && <span className="notification-badge">{notifications.data!.unreadCount > 99 ? '99+' : notifications.data!.unreadCount}</span>}</button>
    {open && <div className="notification-popover" role="dialog" aria-label="알림함"><div className="notification-popover-head"><div><strong>알림</strong><span>{notifications.data?.unreadCount ?? 0}개의 새 알림</span></div><div><button onClick={() => markAllRead.mutate()} disabled={!notifications.data?.unreadCount}><CheckCheck size={15} /></button><button onClick={() => setOpen(false)} aria-label="알림 닫기"><X size={16} /></button></div></div>{notifications.isLoading ? <div className="notification-empty">알림을 불러오는 중이에요.</div> : notifications.data?.items.length ? <div className="notification-list">{notifications.data.items.map(item => <button className={`notification-item ${item.isRead ? '' : 'unread'}`} key={item.id} onClick={() => { if (!item.isRead) markRead.mutate({ notificationId: item.id }); }}><span className={`notification-icon ${item.type}`}>{item.type === 'like' ? <Heart size={16} fill="currentColor" /> : <AtSign size={16} />}</span><span className="notification-copy"><strong>{item.actorName || '모아 회원'}</strong><span>{item.message}</span><small>{relativeTime(item.createdAt)}</small></span>{!item.isRead && <i />}</button>)}</div> : <div className="notification-empty"><Bell size={24} /><strong>새로운 알림이 없어요.</strong><span>댓글 태그와 하트 알림이 여기에 표시됩니다.</span></div>}</div>}
  </div>;
}
