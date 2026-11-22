import { useMemo, useState } from 'react';
import { Ban, CheckCircle2, Flag, Mail, RefreshCw, Search, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

function date(value: Date | string) {
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

type AdminView = 'reports' | 'posts' | 'members' | 'messages';

export function AdminPanel({ role = 'admin' }: { role?: string }) {
  const [activeView, setActiveView] = useState<AdminView>('reports');
  const [query, setQuery] = useState('');
  const snapshot = trpc.admin.snapshot.useQuery(undefined, { refetchOnWindowFocus: true });
  const messages = trpc.admin.messages.useQuery(undefined, { refetchOnWindowFocus: true });
  const updateMessageStatus = trpc.admin.updateMessageStatus.useMutation({ onSuccess: () => { void messages.refetch(); toast.success('메시지 상태를 변경했습니다.'); }, onError: error => toast.error(error.message) });
  const deletePost = trpc.admin.deletePost.useMutation({
    onSuccess: () => { void snapshot.refetch(); toast.success('게시글을 삭제했습니다.'); },
    onError: error => toast.error(error.message),
  });
  const setSuspended = trpc.admin.setSuspended.useMutation({
    onSuccess: () => { void snapshot.refetch(); toast.success('회원 상태를 변경했습니다.'); },
    onError: error => toast.error(error.message),
  });
  const setRole = trpc.admin.setRole.useMutation({
    onSuccess: () => { void snapshot.refetch(); toast.success('관계자 권한을 변경했습니다.'); },
    onError: error => toast.error(error.message),
  });

  const reports = snapshot.data?.reports ?? [];
  const posts = snapshot.data?.posts ?? [];
  const members = snapshot.data?.members ?? [];
  const adminMessages = messages.data ?? [];
  const normalizedQuery = query.trim().toLowerCase();
  const filteredReports = useMemo(() => reports.filter(report => !normalizedQuery || `${report.postTitle ?? ''} ${report.reason} ${report.reporter}`.toLowerCase().includes(normalizedQuery)), [normalizedQuery, reports]);
  const filteredPosts = useMemo(() => posts.filter(post => !normalizedQuery || `${post.title} ${post.author} ${post.category}`.toLowerCase().includes(normalizedQuery)), [normalizedQuery, posts]);
  const filteredMembers = useMemo(() => members.filter(member => !normalizedQuery || `${member.name ?? ''} ${member.email ?? ''} ${member.openId} ${member.role}`.toLowerCase().includes(normalizedQuery)), [normalizedQuery, members]);
  const filteredMessages = useMemo(() => adminMessages.filter(message => !normalizedQuery || `${message.title} ${message.content} ${message.senderName} ${message.category}`.toLowerCase().includes(normalizedQuery)), [adminMessages, normalizedQuery]);

  function openView(view: AdminView) {
    setActiveView(view);
    setQuery('');
  }

  if (snapshot.isLoading) return <section className="admin-panel"><div className="admin-loading"><RefreshCw className="spin" size={20} /> 관리자 정보를 불러오는 중입니다.</div></section>;
  if (snapshot.isError || !snapshot.data) return <section className="admin-panel"><div className="admin-loading">관리자 정보를 불러오지 못했습니다. <button onClick={() => void snapshot.refetch()}>다시 시도</button></div></section>;

  const viewTitle = activeView === 'reports' ? '신고 목록' : activeView === 'posts' ? '게시글 관리' : activeView === 'members' ? '회원 관리' : '문의·건의 메시지';
  const viewDescription = activeView === 'reports' ? '신고 사유와 신고된 게시글을 확인합니다.' : activeView === 'posts' ? '커뮤니티 게시글을 검색하고 관리합니다.' : activeView === 'members' ? '회원 상태와 관계자 권한을 확인합니다.' : '회원이 보낸 문의와 개선 의견을 확인합니다.';

  return <section className="admin-panel">
    <div className="admin-heading"><div><span className="section-kicker"><span /> {role === 'staff' ? 'STAFF SETTINGS' : 'ADMIN CONSOLE'}</span><h3>{role === 'staff' ? '관계자 설정' : '관리자 센터'}</h3><p>신고된 글과 회원 데이터를 화면별로 확인할 수 있습니다.</p></div><ShieldCheck size={28} /></div>
    <div className="admin-stat-grid admin-stat-tabs">
      <button className={activeView === 'reports' ? 'active' : ''} onClick={() => openView('reports')}><strong>{reports.length}</strong><span>신고 접수</span><small>신고 목록 열기</small></button>
      <button className={activeView === 'posts' ? 'active' : ''} onClick={() => openView('posts')}><strong>{posts.length}</strong><span>최근 게시글</span><small>게시글 관리 열기</small></button>
      <button className={activeView === 'members' ? 'active' : ''} onClick={() => openView('members')}><strong>{members.length}</strong><span>회원</span><small>회원 관리 열기</small></button>
      <button className={activeView === 'messages' ? 'active' : ''} onClick={() => openView('messages')}><strong>{adminMessages.filter(message => message.status === 'new').length}</strong><span>문의·건의</span><small>메시지 관리 열기</small></button>
      <button className="admin-stat-static" type="button"><strong>{members.filter(member => member.isSuspended).length}</strong><span>정지 회원</span><small>현재 상태</small></button>
    </div>
    <div className="admin-view-tabs" role="tablist" aria-label="관리자 화면 선택">
      <button className={activeView === 'reports' ? 'active' : ''} onClick={() => openView('reports')} role="tab" aria-selected={activeView === 'reports'}><Flag size={15} /> 신고 목록</button>
      <button className={activeView === 'posts' ? 'active' : ''} onClick={() => openView('posts')} role="tab" aria-selected={activeView === 'posts'}><Trash2 size={15} /> 게시글 관리</button>
      <button className={activeView === 'members' ? 'active' : ''} onClick={() => openView('members')} role="tab" aria-selected={activeView === 'members'}><UserRound size={15} /> 회원 관리</button>
      <button className={activeView === 'messages' ? 'active' : ''} onClick={() => openView('messages')} role="tab" aria-selected={activeView === 'messages'}><Mail size={15} /> 문의·건의</button>
    </div>
    <div className="admin-section admin-view-panel">
      <div className="admin-section-title"><div><strong>{viewTitle}</strong><span>{viewDescription}</span></div><button onClick={() => void snapshot.refetch()}><RefreshCw size={14} /> 새로고침</button></div>
      <label className="admin-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={activeView === 'members' ? '이름·이메일·회원 ID·권한 검색' : activeView === 'posts' ? '제목·내용·작성자·게시판 검색' : activeView === 'messages' ? '제목·내용·작성자·구분 검색' : '신고 사유·신고자·게시글 검색'} /><span>{activeView === 'reports' ? filteredReports.length : activeView === 'posts' ? filteredPosts.length : activeView === 'members' ? filteredMembers.length : filteredMessages.length}건</span></label>
      {activeView === 'reports' && <>{filteredReports.length ? <div className="admin-list">{filteredReports.map(report => <div className="admin-row" key={report.id}><div><strong>{report.commentId ? '댓글 신고' : '게시글 신고'} · {report.postTitle || `게시글 #${report.postId}`}</strong><p>{report.reason}</p><small>{report.reporter} · {date(report.createdAt)}</small></div>{role !== 'staff' && <button className="admin-danger" onClick={() => { if (window.confirm('신고된 게시글을 삭제할까요?')) deletePost.mutate({ postId: report.postId }); }}><Trash2 size={14} /> 게시글 삭제</button>}</div>)}</div> : <div className="admin-empty">검색 조건에 맞는 신고가 없습니다.</div>}</>}
      {activeView === 'posts' && <>{filteredPosts.length ? <div className="admin-list">{filteredPosts.slice(0, 50).map(post => <div className="admin-row" key={post.id}><div><strong>{post.title}</strong><p>{post.category} · {post.author} · {date(post.createdAt)}</p></div>{role !== 'staff' && <button className="admin-danger" onClick={() => { if (window.confirm('이 게시글을 삭제할까요?')) deletePost.mutate({ postId: post.id }); }}><Trash2 size={14} /> 삭제</button>}</div>)}</div> : <div className="admin-empty">검색 조건에 맞는 게시글이 없습니다.</div>}</>}
      {activeView === 'members' && <>{filteredMembers.length ? <div className="admin-list">{filteredMembers.map(member => <div className="admin-row" key={member.id}><div><strong>{member.name || '이름 미설정'} {member.role === 'admin' && <span className="admin-role">관리자</span>}{member.role === 'staff' && <span className="admin-role">관계자</span>}</strong><p>{member.email || member.openId} · 가입 {date(member.createdAt)}</p><small>회원 ID #{member.id}{member.isSuspended ? ' · 정지 상태' : ''}</small></div>{role !== 'staff' && <div className="admin-row-actions">{member.role !== 'admin' && <button className="admin-secondary" onClick={() => setRole.mutate({ userId: member.id, role: member.role === 'staff' ? 'user' : 'staff' })}>{member.role === 'staff' ? '관계자 해제' : '관계자 지정'}</button>}<button className={member.isSuspended ? 'admin-restore' : 'admin-danger'} onClick={() => setSuspended.mutate({ userId: member.id, suspended: !member.isSuspended })}>{member.isSuspended ? <><CheckCircle2 size={14} /> 정지 해제</> : <><Ban size={14} /> 회원 정지</>}</button></div>}</div>)}</div> : <div className="admin-empty">검색 조건에 맞는 회원이 없습니다.</div>}</>}
      {activeView === 'messages' && <>{filteredMessages.length ? <div className="admin-list">{filteredMessages.map(message => <div className="admin-row" key={message.id}><div><strong>{message.category} · {message.title}</strong><p>{message.content}</p><small>{message.senderName}{message.senderEmail ? ` · ${message.senderEmail}` : ''} · {date(message.createdAt)}</small></div><select value={message.status} onChange={event => updateMessageStatus.mutate({ id: message.id, status: event.target.value as 'new' | 'read' | 'resolved' })} aria-label={`${message.title} 상태`}><option value="new">새 메시지</option><option value="read">확인 중</option><option value="resolved">처리 완료</option></select></div>)}</div> : <div className="admin-empty">접수된 문의·건의가 없습니다.</div>}</>}
    </div>
  </section>;
}
