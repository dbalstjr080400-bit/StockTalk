import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { LoaderCircle, MessageCircle, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { STOCKS, relativeTime, stockFor } from '@/lib/stocks';
import { Avatar, StockIcon, type Post } from './CommunityParts';

type Draft = { ticker: string; stockName: string; category: string; title: string; content: string; author: string };

function Modal({ children, onClose, label }: { children: ReactNode; onClose: () => void; label: string }) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    document.body.classList.add('modal-open');
    return () => { window.removeEventListener('keydown', handler); document.body.classList.remove('modal-open'); };
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal-panel" role="dialog" aria-modal="true" aria-label={label}>{children}</section></div>;
}

export function ComposeDialog({ initialTicker, nickname, onNickname, onClose, onSubmit, pending }: { initialTicker: string; nickname: string; onNickname: (value: string) => void; onClose: () => void; onSubmit: (draft: Draft) => void; pending: boolean }) {
  const [ticker, setTicker] = useState(initialTicker === 'all' ? STOCKS[0].ticker : initialTicker);
  const [category, setCategory] = useState('자유토론');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [author, setAuthor] = useState(nickname);
  function submit(event: FormEvent) {
    event.preventDefault();
    const stock = stockFor(ticker);
    if (!stock || !title.trim() || !content.trim() || !author.trim()) return;
    onNickname(author.trim());
    onSubmit({ ticker, stockName: stock.name, category, title: title.trim(), content: content.trim(), author: author.trim() });
  }
  return <Modal onClose={onClose} label="새 이야기 작성">
    <div className="dialog-heading"><div><span className="eyebrow">SHARE YOUR THOUGHTS</span><h2>새 이야기 쓰기</h2><p>나의 생각이 누군가에게 새로운 관점이 될 수 있어요.</p></div><button className="icon-button" onClick={onClose} aria-label="닫기"><X size={21} /></button></div>
    <form onSubmit={submit} className="compose-form">
      <div className="form-two"><label>종목<select value={ticker} onChange={(e) => setTicker(e.target.value)}>{STOCKS.map((stock) => <option value={stock.ticker} key={stock.ticker}>{stock.name} · {stock.ticker}</option>)}</select></label><label>말머리<select value={category} onChange={(e) => setCategory(e.target.value)}><option>자유토론</option><option>종목분석</option><option>질문</option><option>투자아이디어</option></select></label></div>
      <label>닉네임<input required maxLength={20} value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="대화에 사용할 닉네임" /></label>
      <label>제목<input required maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="어떤 이야기를 나누고 싶나요?" /></label>
      <label>내용<textarea required maxLength={4000} value={content} onChange={(e) => setContent(e.target.value)} placeholder="서로의 생각을 존중하며 이야기를 나눠주세요." rows={7} /></label>
      <div className="form-footer"><span>투자 판단은 스스로, 대화는 따뜻하게.</span><button disabled={pending} className="primary-button" type="submit">{pending ? '등록 중...' : '이야기 올리기'} <ArrowIcon /></button></div>
    </form>
  </Modal>;
}
function ArrowIcon() { return <span aria-hidden="true">↗</span>; }

export function ThreadDialog({ post, nickname, onNickname, onClose, onChanged }: { post: Post; nickname: string; onNickname: (name: string) => void; onClose: () => void; onChanged: () => void }) {
  const [author, setAuthor] = useState(nickname);
  const [content, setContent] = useState('');
  const comments = trpc.discussion.comments.useQuery({ postId: post.id }, { refetchInterval: 30_000 });
  const addComment = trpc.discussion.addComment.useMutation({
    onSuccess: () => { setContent(''); void comments.refetch(); onChanged(); toast.success('댓글을 남겼어요.'); },
    onError: () => toast.error('댓글을 등록하지 못했어요. 다시 시도해 주세요.'),
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!author.trim() || !content.trim()) return;
    onNickname(author.trim());
    addComment.mutate({ postId: post.id, author: author.trim(), content: content.trim() });
  }
  return <Modal onClose={onClose} label="게시글과 댓글">
    <div className="thread-top"><div className="post-stock static"><StockIcon stock={stockFor(post.ticker)} size="small" /><span>{post.stockName}</span><span className="post-category">{post.category}</span>{post.isDemo && <span className="demo-tag">예시 글</span>}</div><button className="icon-button" onClick={onClose} aria-label="닫기"><X size={21} /></button></div>
    <div className="thread-body"><h2>{post.title}</h2><div className="post-author"><Avatar name={post.author} /><strong>{post.author}</strong><i /><span className="post-time">{relativeTime(post.createdAt)}</span></div><p className="thread-content">{post.content}</p>
      <div className="comments-heading"><MessageCircle size={18} /><strong>댓글</strong><span>{comments.data?.length ?? post.comments}</span></div>
      {comments.isLoading ? <div className="empty-comments"><LoaderCircle className="spin" size={19} /> 댓글을 불러오는 중이에요.</div> : comments.isError ? <div className="empty-comments">댓글을 불러오지 못했어요. <button onClick={() => void comments.refetch()}>다시 시도</button></div> : comments.data?.length ? <div className="comment-list">{comments.data.map((comment) => <div className="comment" key={comment.id}><Avatar name={comment.author} /><div><div className="comment-meta"><strong>{comment.author}</strong><span>{relativeTime(comment.createdAt)}</span></div><p>{comment.content}</p></div></div>)}</div> : <div className="empty-comments">아직 댓글이 없어요. 첫 번째 생각을 나눠보세요.</div>}
    </div>
    <form className="comment-form" onSubmit={submit}><input aria-label="닉네임" required maxLength={20} value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="닉네임" /><div><input aria-label="댓글" required maxLength={1000} value={content} onChange={(e) => setContent(e.target.value)} placeholder="따뜻한 의견을 남겨주세요" /><button disabled={addComment.isPending} aria-label="댓글 등록"><Send size={18} /></button></div></form>
  </Modal>;
}
