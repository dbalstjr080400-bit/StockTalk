import { useState } from 'react';
import { Mail, X } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

type Props = { onClose: () => void };

export function AdminMessageDialog({ onClose }: Props) {
  const [category, setCategory] = useState<'문의' | '건의'>('문의');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const create = trpc.adminMessages.create.useMutation({
    onSuccess: () => { toast.success('관리자에게 메시지를 보냈어요.'); onClose(); },
    onError: error => toast.error(error.message || '메시지를 보내지 못했어요.'),
  });
  return <div className="dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="community-dialog admin-message-dialog" role="dialog" aria-modal="true" aria-label="관리자에게 메시지 보내기">
      <div className="dialog-heading"><div><span className="section-kicker"><span /> CONTACT ADMIN</span><h3>관리자에게 메시지 보내기</h3><p>서비스 문의나 개선 의견을 남겨주시면 확인하겠습니다.</p></div><button type="button" className="dialog-close" onClick={onClose} aria-label="닫기"><X size={18} /></button></div>
      <form onSubmit={event => { event.preventDefault(); if (!title.trim() || !content.trim()) { toast.error('제목과 내용을 입력해 주세요.'); return; } create.mutate({ category, title: title.trim(), content: content.trim() }); }}>
        <div className="compose-category-tabs"><button type="button" className={category === '문의' ? 'active' : ''} onClick={() => setCategory('문의')}>문의</button><button type="button" className={category === '건의' ? 'active' : ''} onClick={() => setCategory('건의')}>건의</button></div>
        <label>제목<input value={title} onChange={event => setTitle(event.target.value)} maxLength={120} placeholder="제목을 입력해 주세요" /></label>
        <label>내용<textarea value={content} onChange={event => setContent(event.target.value)} maxLength={3000} rows={7} placeholder="문의나 건의 내용을 입력해 주세요" /></label>
        <div className="dialog-actions"><button type="button" onClick={onClose}>취소</button><button type="submit" disabled={create.isPending}><Mail size={15} /> {create.isPending ? '보내는 중…' : '보내기'}</button></div>
      </form>
    </section>
  </div>;
}
