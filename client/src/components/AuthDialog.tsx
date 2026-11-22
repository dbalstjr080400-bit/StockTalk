import { Apple, MessageCircle, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

function ProviderButton({ icon, children, className = '', onClick }: { icon: ReactNode; children: ReactNode; className?: string; onClick: () => void }) {
  return <button type="button" className={`auth-provider-button ${className}`} onClick={onClick}>{icon}<span>{children}</span></button>;
}

export function AuthDialog({ onClose, onLogin }: { onClose: () => void; onLogin: () => void }) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return <div className="auth-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title">
      <button type="button" className="auth-dialog-close" onClick={onClose} aria-label="로그인 창 닫기"><X size={21} /></button>
      <div className="auth-dialog-mark"><img src="/logo.svg" alt="" /></div>
      <span className="auth-dialog-eyebrow">MOA COMMUNITY</span>
      <h2 id="auth-dialog-title">모아에 오신 걸<br />환영해요</h2>
      <p className="auth-dialog-subtitle">간편 로그인으로 투자 이야기를 시작하세요</p>
      <div className="auth-provider-list">
        <ProviderButton className="kakao" icon={<MessageCircle size={20} fill="currentColor" />} onClick={onLogin}>카카오로 로그인</ProviderButton>
        <ProviderButton className="naver" icon={<span className="naver-mark">N</span>} onClick={onLogin}>네이버로 로그인</ProviderButton>
        <ProviderButton className="apple" icon={<Apple size={22} fill="currentColor" />} onClick={onLogin}>Apple로 로그인</ProviderButton>
      </div>
      <p className="auth-dialog-note">기존 계정은 기존 로그인 방법을 이용해 주세요.</p>
    </section>
  </div>;
}
