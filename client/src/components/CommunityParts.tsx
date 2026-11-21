import { useState } from 'react';
import { ArrowUpRight, Flag, Heart, MessageCircle, MoreHorizontal, Pencil, Share2, Star, Trash2 } from 'lucide-react';
import { relativeTime, stockFor, type Stock } from '@/lib/stocks';

export type Post = {
  id: number; ticker: string; stockName: string; category: string; title: string;
  content: string; author: string; createdAt: Date | string; likes: number;
  comments: number; views: number; liked: boolean; isDemo: boolean; isEdited: boolean;
};

export function StockIcon({ stock, size = 'normal' }: { stock?: Stock; size?: 'normal' | 'small' | 'large' }) {
  return <span className={`stock-icon ${size}`} style={{ color: stock?.color || '#566479', background: stock?.background || '#eef1f5' }}>{stock?.initials || '•'}</span>;
}

export function Sparkline({ values, negative = false }: { values: number[]; negative?: boolean }) {
  const min = Math.min(...values), max = Math.max(...values);
  const points = values.map((value, i) => `${(i / (values.length - 1)) * 58},${19 - (value - min) / (max - min || 1) * 15}`).join(' ');
  return <svg className="sparkline" viewBox="0 0 58 22" aria-hidden="true"><polyline points={points} fill="none" stroke={negative ? '#5880cb' : '#ef7068'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

const avatarColors = ['#dbe8ff', '#e9e0ff', '#ffe5d6', '#e2f2e9', '#ffe8ee', '#e8ebf5'];
function avatarColor(name: string) { return avatarColors[Array.from(name).reduce((n, c) => n + c.charCodeAt(0), 0) % avatarColors.length]; }

export function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  return <span className={`avatar ${large ? 'avatar-large' : ''}`} style={{ backgroundColor: avatarColor(name) }} aria-hidden="true">{name.trim().slice(0, 1) || '모'}</span>;
}

export function WatchStar({ active, onClick, name }: { active: boolean; onClick: () => void; name: string }) {
  return <button type="button" className={`star-button ${active ? 'active' : ''}`} aria-label={`${name} 관심 종목 ${active ? '해제' : '추가'}`} onClick={(e) => { e.stopPropagation(); onClick(); }}><Star size={17} fill={active ? 'currentColor' : 'none'} /></button>;
}

function postTags(content: string) { return [...new Set(content.match(/#[^\s#]+/g) ?? [])].slice(0, 8); }

export function PostCard({ post, stock, onLike, onComments, onStock, currentAuthor, onEdit, onDelete, onReport }: { post: Post; stock?: Stock; onLike: () => void; onComments: () => void; onStock: () => void; currentAuthor?: string; onEdit?: () => void; onDelete?: () => void; onReport?: () => void }) {
  stock = stock ?? stockFor(post.ticker);
  const [menuOpen, setMenuOpen] = useState(false);
  function share() {
    const url = `${window.location.origin}${window.location.pathname}#post-${post.id}`;
    if (navigator.share) { void navigator.share({ title: post.title, text: post.content.slice(0, 120), url }).catch(() => undefined); }
    else void navigator.clipboard?.writeText(url);
  }
  return <article className="post-card">
    <div className="post-topline">
      <button className="post-stock" onClick={onStock}><StockIcon stock={stock} size="small" /><span>{post.stockName}</span><ArrowUpRight size={13} /></button>
      <span className="post-category">{post.category}</span>
      {post.isDemo && <span className="demo-tag">예시 글</span>}
      {post.isEdited && <span className="edited-tag">수정함</span>}
      <div className="post-menu-wrap"><button className="post-more" aria-label="게시글 메뉴" onClick={() => setMenuOpen(value => !value)}><MoreHorizontal size={20} /></button>{menuOpen && <div className="post-menu" role="menu"><button onClick={() => { setMenuOpen(false); share(); }}><Share2 size={14} /> 공유</button>{currentAuthor === post.author && onEdit && <button onClick={() => { setMenuOpen(false); onEdit(); }}><Pencil size={14} /> 수정</button>}{currentAuthor === post.author && onDelete && <button className="danger" onClick={() => { setMenuOpen(false); onDelete(); }}><Trash2 size={14} /> 삭제</button>}{onReport && <button onClick={() => { setMenuOpen(false); onReport(); }}><Flag size={14} /> 신고</button>}</div>}</div>
    </div>
    <button className="post-content" onClick={onComments}>
      <h3>{post.title}</h3>
      <p>{post.content}</p>
      {postTags(post.content).length > 0 && <div className="post-tags" aria-label="게시글 태그">{postTags(post.content).map((tag) => <span key={tag}>{tag}</span>)}</div>}
    </button>
    <div className="post-bottom">
      <div className="post-author"><Avatar name={post.author} /><span>{post.author}</span><i /> <span className="post-time">{relativeTime(post.createdAt)}</span></div>
      <div className="post-actions">
        <span className="post-views">조회 {post.views}</span>
        <button className={post.liked ? 'liked' : ''} onClick={onLike} aria-label={post.liked ? '공감 취소' : '공감하기'}><Heart size={16} fill={post.liked ? 'currentColor' : 'none'} /><span>{post.likes}</span></button>
        <button onClick={onComments} aria-label="댓글 보기"><MessageCircle size={16} /><span>{post.comments}</span></button>
      </div>
    </div>
  </article>;
}
