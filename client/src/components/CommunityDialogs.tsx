import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Flag, LoaderCircle, MessageCircle, MoreHorizontal, Pencil, Send, Share2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { relativeTime, stockFor, type Stock } from '@/lib/stocks';
import { Avatar, StockIcon, type Post } from './CommunityParts';
import { StockPicker } from './StockPicker';

type Draft = { ticker: string; stockName: string; category: string; title: string; content: string; author: string };
const FREE_BOARD_TAGS = ['분석', '수익인증', '질문', '투자아이디어', '뉴스·이슈', '배당', '단기투자', '장기투자'] as const;

function Modal({ children, onClose, label }: { children: ReactNode; onClose: () => void; label: string }) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    document.body.classList.add('modal-open');
    return () => { window.removeEventListener('keydown', handler); document.body.classList.remove('modal-open'); };
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal-panel" role="dialog" aria-modal="true" aria-label={label}>{children}</section></div>;
}

export function ComposeDialog({ initialStock, initialCategory, stocks, popular, loading, error, retry, nickname, onNickname, onClose, onSubmit, pending, hideBoardSelector = false }: { initialStock?: Stock; initialCategory: string; stocks: Stock[]; popular: Stock[]; loading: boolean; error: boolean; retry: () => void; nickname: string; onNickname: (value: string) => void; onClose: () => void; onSubmit: (draft: Draft) => void; pending: boolean; hideBoardSelector?: boolean }) {
  const [stock, setStock] = useState<Stock | undefined>(initialStock ?? popular[0]);
  const [category, setCategory] = useState(initialCategory);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [author, setAuthor] = useState(nickname);
  // A directory response arriving while the dialog is open replaces only the
  // selected example's metadata, never the user's in-progress search.
  useEffect(() => {
    if (!stock) return;
    const canonical = stocks.find((item) => item.ticker === stock.ticker);
    if (canonical && canonical !== stock) setStock(canonical);
  }, [stocks, stock]);
  useEffect(() => { if (category !== '자유게시판') setTags([]); }, [category]);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!stock || !title.trim() || !content.trim() || !author.trim()) return;
    onNickname(author.trim());
    const normalizedTags = category === '자유게시판' ? tags.map((tag) => `#${tag}`) : [];
    const taggedContent = normalizedTags.length ? `${content.trim()}\n\n${normalizedTags.join(' ')}` : content.trim();
    onSubmit({ ticker: stock.ticker, stockName: stock.name, category, title: title.trim(), content: taggedContent, author: author.trim() });
  }
  return <Modal onClose={onClose} label="새 이야기 작성">
    <div className="dialog-heading"><div><span className="eyebrow">SHARE YOUR THOUGHTS</span><h2>새 이야기 쓰기</h2><p>나의 생각이 누군가에게 새로운 관점이 될 수 있어요.</p><small className="compose-policy">주식과 관련 없는 이야기는 삭제될 수 있습니다.</small></div><button className="icon-button" onClick={onClose} aria-label="닫기"><X size={21} /></button></div>
    <form onSubmit={submit} className="compose-form">
      <div className={`form-two ${hideBoardSelector ? 'board-selector-hidden' : ''}`}><StockPicker stocks={stocks} popular={popular} selected={stock} onSelect={setStock} loading={loading} error={error} retry={retry} />{!hideBoardSelector && <label>게시판<select value={category} onChange={(e) => setCategory(e.target.value)}><option>종목토론</option><option>자유게시판</option></select></label>}</div>
      <label>닉네임<input required maxLength={20} value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="대화에 사용할 닉네임" /></label>
      <label>제목<input required maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="어떤 이야기를 나누고 싶나요?" /></label>
      {category === '자유게시판' && <fieldset className="tag-picker"><legend>태그 <small>선택사항 · 최대 8개</small></legend><div className="tag-option-list">{FREE_BOARD_TAGS.map((tag) => <button type="button" key={tag} className={tags.includes(tag) ? 'selected' : ''} onClick={() => setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])}>#{tag}</button>)}</div></fieldset>}
      <label>내용<textarea required maxLength={4000} value={content} onChange={(e) => setContent(e.target.value)} placeholder="서로의 생각을 존중하며 이야기를 나눠주세요." rows={7} /></label>
      <div className="form-footer"><span>투자 판단은 스스로, 대화는 따뜻하게.</span><button disabled={pending || !stock} className="primary-button" type="submit">{pending ? '등록 중...' : '이야기 올리기'} <ArrowIcon /></button></div>
    </form>
  </Modal>;
}
function ArrowIcon() { return <span aria-hidden="true">↗</span>; }

export function EditPostDialog({ post, onClose, onSubmit, pending }: { post: Post; onClose: () => void; onSubmit: (title: string, content: string) => void; pending: boolean }) {
  const [title, setTitle] = useState(post.title);
  const [content, setContent] = useState(post.content);
  return <Modal onClose={onClose} label="게시글 수정"><div className="dialog-heading"><div><span className="eyebrow">EDIT YOUR POST</span><h2>게시글 수정</h2><p>수정한 게시물에는 수정함 표시가 남습니다.</p></div><button className="icon-button" onClick={onClose} aria-label="닫기"><X size={21} /></button></div><form className="compose-form" onSubmit={(event) => { event.preventDefault(); if (title.trim() && content.trim()) onSubmit(title.trim(), content.trim()); }}><label>제목<input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>내용<textarea required maxLength={5000} rows={9} value={content} onChange={(event) => setContent(event.target.value)} /></label><div className="form-footer"><span>게시판과 종목은 유지됩니다.</span><button className="primary-button" disabled={pending} type="submit">{pending ? '저장 중...' : '수정 저장'} <ArrowIcon /></button></div></form></Modal>;
}

export function ThreadDialog({ post, stock, nickname, currentAuthor, onNickname, onClose, onChanged, canManage, onEdit, onDelete, onShare }: { post: Post; stock?: Stock; nickname: string; currentAuthor?: string; onNickname: (name: string) => void; onClose: () => void; onChanged: () => void; canManage: boolean; onEdit: () => void; onDelete: () => void; onShare: () => void }) {
  const [author, setAuthor] = useState(nickname);
  const [content, setContent] = useState('');
  const [openCommentMenu, setOpenCommentMenu] = useState<number | null>(null);
  const comments = trpc.discussion.comments.useQuery({ postId: post.id }, { refetchInterval: 30_000 });
  const addComment = trpc.discussion.addComment.useMutation({
    onSuccess: () => { setContent(''); void comments.refetch(); onChanged(); toast.success('댓글을 남겼어요.'); },
    onError: () => toast.error('댓글을 등록하지 못했어요. 다시 시도해 주세요.'),
  });
  const updateComment = trpc.discussion.updateComment.useMutation({ onSuccess: () => { void comments.refetch(); onChanged(); toast.success('댓글을 수정했어요.'); }, onError: error => toast.error(error.message || '댓글을 수정하지 못했어요.') });
  const removeComment = trpc.discussion.removeComment.useMutation({ onSuccess: () => { void comments.refetch(); onChanged(); toast.success('댓글을 삭제했어요.'); }, onError: error => toast.error(error.message || '댓글을 삭제하지 못했어요.') });
  const reportComment = trpc.discussion.reportComment.useMutation({ onSuccess: () => toast.success('댓글 신고가 접수되었어요.'), onError: error => toast.error(error.message || '댓글 신고를 접수하지 못했어요.') });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!author.trim() || !content.trim()) return;
    onNickname(author.trim());
    addComment.mutate({ postId: post.id, author: author.trim(), content: content.trim() });
  }
  return <Modal onClose={onClose} label="게시글과 댓글">
    <div className="thread-top"><div className="post-stock static"><StockIcon stock={stock ?? stockFor(post.ticker)} size="small" /><span>{post.stockName}</span><span className="post-category">{post.category}</span>{post.isDemo && <span className="demo-tag">예시 글</span>}</div><button className="icon-button" onClick={onClose} aria-label="닫기"><X size={21} /></button></div>
    <div className="thread-body"><div className="thread-title-row"><h2>{post.title}</h2>{post.isEdited && <span className="edited-tag">수정함</span>}</div><div className="post-author"><Avatar name={post.author} /><strong>{post.author}</strong><i /><span className="post-time">{relativeTime(post.createdAt)}</span></div><div className="thread-post-actions"><button onClick={onShare}><Share2 size={14} /> 공유</button>{canManage && <><button onClick={onEdit}><Pencil size={14} /> 수정</button><button className="danger" onClick={onDelete}><Trash2 size={14} /> 삭제</button></>}</div><p className="thread-content">{post.content}</p>
      <div className="comments-heading"><MessageCircle size={18} /><strong>댓글</strong><span>{comments.data?.length ?? post.comments}</span></div>
      {comments.isLoading ? <div className="empty-comments"><LoaderCircle className="spin" size={19} /> 댓글을 불러오는 중이에요.</div> : comments.isError ? <div className="empty-comments">댓글을 불러오지 못했어요. <button onClick={() => void comments.refetch()}>다시 시도</button></div> : comments.data?.length ? <div className="comment-list">{comments.data.map((comment) => <div className="comment" key={comment.id}><Avatar name={comment.author} /><div><div className="comment-meta"><strong>{comment.author}</strong>{comment.isEdited && <span className="edited-tag">수정함</span>}<span>{relativeTime(comment.createdAt)}</span><div className="comment-menu-wrap"><button className="comment-more" onClick={() => setOpenCommentMenu(openCommentMenu === comment.id ? null : comment.id)} aria-label="댓글 메뉴"><MoreHorizontal size={15} /></button>{openCommentMenu === comment.id && <div className="post-menu comment-menu"><button onClick={() => { const url = `${window.location.origin}${window.location.pathname}#post-${post.id}-comment-${comment.id}`; void navigator.clipboard?.writeText(url); setOpenCommentMenu(null); toast.success('댓글 링크를 복사했어요.'); }}><Share2 size={14} /> 공유</button>{currentAuthor === comment.author && <button onClick={() => { const next = window.prompt('댓글 내용을 수정해 주세요.', comment.content); if (next?.trim()) updateComment.mutate({ commentId: comment.id, author: comment.author, content: next.trim() }); setOpenCommentMenu(null); }}><Pencil size={14} /> 수정</button>}{currentAuthor === comment.author && <button className="danger" onClick={() => { if (window.confirm('이 댓글을 삭제할까요?')) removeComment.mutate({ commentId: comment.id, author: comment.author }); setOpenCommentMenu(null); }}><Trash2 size={14} /> 삭제</button>}<button onClick={() => { const reason = window.prompt('댓글 신고 사유를 입력해 주세요.', '부적절한 내용'); if (reason?.trim()) reportComment.mutate({ postId: post.id, commentId: comment.id, reporter: currentAuthor || '익명', reason: reason.trim() }); setOpenCommentMenu(null); }}><Flag size={14} /> 신고</button></div>}</div></div><p>{comment.content}</p></div></div>)}</div> : <div className="empty-comments">아직 댓글이 없어요. 첫 번째 생각을 나눠보세요.</div>}
    </div>
    <form className="comment-form" onSubmit={submit}><input aria-label="닉네임" required maxLength={20} value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="닉네임" /><div><input aria-label="댓글" required maxLength={1000} value={content} onChange={(e) => setContent(e.target.value)} placeholder="따뜻한 의견을 남겨주세요" /><button disabled={addComment.isPending} aria-label="댓글 등록"><Send size={18} /></button></div></form>
  </Modal>;
}
