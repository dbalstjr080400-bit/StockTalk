import { ShieldCheck, Trash2, UserRound, Flag, RefreshCw, Ban, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

function date(value: Date | string) { return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)); }

export function AdminPanel() {
  const snapshot = trpc.admin.snapshot.useQuery(undefined, { refetchOnWindowFocus: true });
  const deletePost = trpc.admin.deletePost.useMutation({ onSuccess: () => { void snapshot.refetch(); toast.success('게시글을 삭제했습니다.'); }, onError: error => toast.error(error.message) });
  const setSuspended = trpc.admin.setSuspended.useMutation({ onSuccess: () => { void snapshot.refetch(); toast.success('회원 상태를 변경했습니다.'); }, onError: error => toast.error(error.message) });
  if (snapshot.isLoading) return <section className="admin-panel"><div className="admin-loading"><RefreshCw className="spin" size={20} /> 관리자 정보를 불러오는 중입니다.</div></section>;
  if (snapshot.isError || !snapshot.data) return <section className="admin-panel"><div className="admin-loading">관리자 정보를 불러오지 못했습니다. <button onClick={() => void snapshot.refetch()}>다시 시도</button></div></section>;
  const { reports, members, posts } = snapshot.data;
  return <section className="admin-panel">
    <div className="admin-heading"><div><span className="section-kicker"><span /> ADMIN CONSOLE</span><h3>관리자 센터</h3><p>신고와 커뮤니티 운영 상태를 관리합니다.</p></div><ShieldCheck size={28} /></div>
    <div className="admin-stat-grid"><div><strong>{reports.length}</strong><span>신고 접수</span></div><div><strong>{posts.length}</strong><span>최근 게시글</span></div><div><strong>{members.length}</strong><span>회원</span></div><div><strong>{members.filter(member => member.isSuspended).length}</strong><span>정지 회원</span></div></div>
    <div className="admin-section"><div className="admin-section-title"><div><Flag size={17} /><h4>신고 목록</h4></div><button onClick={() => void snapshot.refetch()}><RefreshCw size={14} /> 새로고침</button></div>{reports.length ? <div className="admin-list">{reports.map(report => <div className="admin-row" key={report.id}><div><strong>{report.commentId ? '댓글 신고' : '게시글 신고'} · {report.postTitle || `게시글 #${report.postId}`}</strong><p>{report.reason}</p><small>{report.reporter} · {date(report.createdAt)}</small></div><button className="admin-danger" onClick={() => { if (window.confirm('신고된 게시글을 삭제할까요?')) deletePost.mutate({ postId: report.postId }); }}><Trash2 size={14} /> 게시글 삭제</button></div>)}</div> : <div className="admin-empty">접수된 신고가 없습니다.</div>}</div>
    <div className="admin-section"><div className="admin-section-title"><div><Trash2 size={17} /><h4>게시글 삭제 관리</h4></div></div>{posts.length ? <div className="admin-list">{posts.slice(0, 30).map(post => <div className="admin-row" key={post.id}><div><strong>{post.title}</strong><p>{post.category} · {post.author} · {date(post.createdAt)}</p></div><button className="admin-danger" onClick={() => { if (window.confirm('이 게시글을 삭제할까요?')) deletePost.mutate({ postId: post.id }); }}><Trash2 size={14} /> 삭제</button></div>)}</div> : <div className="admin-empty">게시글이 없습니다.</div>}</div>
    <div className="admin-section"><div className="admin-section-title"><div><UserRound size={17} /><h4>회원 관리</h4></div></div>{members.length ? <div className="admin-list">{members.map(member => <div className="admin-row" key={member.id}><div><strong>{member.name || '이름 미설정'} {member.role === 'admin' && <span className="admin-role">관리자</span>}</strong><p>{member.email || member.openId} · 가입 {date(member.createdAt)}</p></div><button className={member.isSuspended ? 'admin-restore' : 'admin-danger'} onClick={() => setSuspended.mutate({ userId: member.id, suspended: !member.isSuspended })}>{member.isSuspended ? <><CheckCircle2 size={14} /> 정지 해제</> : <><Ban size={14} /> 회원 정지</>}</button></div>)}</div> : <div className="admin-empty">회원이 없습니다.</div>}</div>
  </section>;
}
