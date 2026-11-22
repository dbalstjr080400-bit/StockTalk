import { useEffect } from 'react';
import { ArrowUpRight, CalendarDays, UserPlus, UserRound, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { relativeTime } from '@/lib/stocks';
import { Avatar } from './CommunityParts';

export function ProfileDialog({ nickname, isAuthenticated, onClose, onLogin }: { nickname: string; isAuthenticated: boolean; onClose: () => void; onLogin: () => void }) {
  const profile = trpc.profile.byNickname.useQuery({ nickname }, { retry: false, throwOnError: false });
  const status = trpc.follows.status.useQuery({ userId: profile.data?.id ?? 0 }, { enabled: isAuthenticated && Boolean(profile.data?.id) });
  const follow = trpc.follows.follow.useMutation({ onSuccess: () => { void status.refetch(); void profile.refetch(); toast.success(`${nickname}님을 팔로우했어요.`); }, onError: error => toast.error(error.message || '팔로우하지 못했어요.') });
  const unfollow = trpc.follows.unfollow.useMutation({ onSuccess: () => { void status.refetch(); void profile.refetch(); toast.success(`${nickname}님을 언팔로우했어요.`); }, onError: error => toast.error(error.message || '언팔로우하지 못했어요.') });
  useEffect(() => { const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, [onClose]);
  const userId = profile.data?.id;
  return <div className="profile-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="profile-dialog" role="dialog" aria-modal="true" aria-label={`${nickname} 프로필`}>
      <button className="profile-dialog-close" onClick={onClose} aria-label="프로필 닫기"><X size={20} /></button>
      {profile.isLoading ? <div className="profile-dialog-state">프로필을 불러오는 중이에요.</div> : profile.isError ? <div className="profile-dialog-state">프로필을 찾을 수 없어요.</div> : profile.data ? <>
        <div className="profile-dialog-hero"><Avatar name={profile.data.profileNickname || nickname} large /><div><span className="section-kicker"><span /> MOA PROFILE</span><h2>{profile.data.profileNickname || nickname}</h2><p>{profile.data.name || '모아 회원'}님의 투자 활동</p></div></div>
        <div className="profile-dialog-stats"><div><strong>{profile.data.postCount}</strong><span>게시글</span></div><div><strong>{profile.data.followerCount}</strong><span>팔로워</span></div><div><strong>{profile.data.followingCount}</strong><span>팔로잉</span></div></div>
        {isAuthenticated ? <button className={`profile-follow-button ${status.data?.following ? 'following' : ''}`} disabled={!userId || follow.isPending || unfollow.isPending} onClick={() => { if (!userId) return; if (status.data?.following) unfollow.mutate({ userId }); else follow.mutate({ userId }); }}>{status.data?.following ? <><Users size={16} /> 팔로잉</> : <><UserPlus size={16} /> 팔로우</>}</button> : <button className="profile-follow-button" onClick={onLogin}><UserPlus size={16} /> 로그인하고 팔로우</button>}
        <div className="profile-activity-heading"><div><span className="section-kicker"><span /> ACTIVITY</span><h3>작성한 글</h3></div><CalendarDays size={18} /></div>
        {profile.data.activities.length ? <div className="profile-activity-list">{profile.data.activities.map(activity => <button className="profile-activity-item" key={activity.id} onClick={onClose}><div><strong>{activity.title}</strong><p>{activity.content.slice(0, 110)}</p><small>{activity.stockName} · {relativeTime(activity.createdAt)}</small></div><ArrowUpRight size={16} /></button>)}</div> : <div className="profile-dialog-empty"><UserRound size={22} /><span>아직 작성한 글이 없어요.</span></div>}
      </> : <div className="profile-dialog-state">존재하지 않는 프로필입니다.</div>}
    </section>
  </div>;
}
