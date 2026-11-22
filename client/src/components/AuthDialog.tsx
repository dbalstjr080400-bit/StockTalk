import { Apple, LockKeyhole, MessageCircle, UserRound, X } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

function ProviderButton({ icon, children, className = '', onClick }: { icon: ReactNode; children: ReactNode; className?: string; onClick: () => void }) {
  return <button type="button" className={`auth-provider-button ${className}`} onClick={onClick}>{icon}<span>{children}</span></button>;
}

export function AuthDialog({ onClose, onLogin, onAuthenticated }: { onClose: () => void; onLogin: () => void; onAuthenticated: () => void }) {
  const [mode, setMode] = useState<'social' | 'login' | 'register'>('social');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const register = trpc.auth.register.useMutation({ onSuccess: () => { toast.success('회원가입이 완료됐어요.'); onAuthenticated(); onClose(); }, onError: error => toast.error(error.message || '회원가입을 완료하지 못했어요.') });
  const localLogin = trpc.auth.loginLocal.useMutation({ onSuccess: () => { toast.success('로그인했어요.'); onAuthenticated(); onClose(); }, onError: error => toast.error(error.message || '로그인하지 못했어요.') });
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (mode === 'register') register.mutate({ loginId: loginId.trim(), password, name: name.trim(), profileNickname: nickname.trim() });
    else localLogin.mutate({ loginId: loginId.trim(), password });
  }
  return <div className="auth-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title">
      <button type="button" className="auth-dialog-close" onClick={onClose} aria-label="로그인 창 닫기"><X size={21} /></button>
      <div className="auth-dialog-mark"><img src="/logo.svg" alt="" /></div>
      <span className="auth-dialog-eyebrow">MOA COMMUNITY</span>
      <h2 id="auth-dialog-title">{mode === 'register' ? <>모아 계정을<br />만들어 보세요</> : mode === 'login' ? <>다시 만나서<br />반가워요</> : <>모아에 오신 걸<br />환영해요</>}</h2>
      <p className="auth-dialog-subtitle">{mode === 'social' ? '간편 로그인으로 투자 이야기를 시작하세요' : 'SMS 인증 없이 아이디와 비밀번호로 이용할 수 있어요'}</p>
      {mode === 'social' ? <><div className="auth-provider-list"><ProviderButton className="kakao" icon={<MessageCircle size={20} fill="currentColor" />} onClick={onLogin}>카카오로 로그인</ProviderButton><ProviderButton className="naver" icon={<span className="naver-mark">N</span>} onClick={onLogin}>네이버로 로그인</ProviderButton><ProviderButton className="apple" icon={<Apple size={22} fill="currentColor" />} onClick={onLogin}>Apple로 로그인</ProviderButton></div><div className="auth-local-actions"><button type="button" onClick={() => setMode('login')}>아이디로 로그인</button><button type="button" onClick={() => setMode('register')}>회원가입</button></div></> : <form className="auth-local-form" onSubmit={submit}><label>아이디<input required minLength={4} maxLength={40} value={loginId} onChange={event => setLoginId(event.target.value)} placeholder="영문·숫자 4자 이상" autoComplete="username" /></label><label>비밀번호<input required minLength={8} maxLength={128} type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="8자 이상" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} /></label>{mode === 'register' && <><label>이름<input required maxLength={40} value={name} onChange={event => setName(event.target.value)} placeholder="이름을 입력해 주세요" /></label><label>닉네임<input required maxLength={40} value={nickname} onChange={event => setNickname(event.target.value)} placeholder="게시판에 표시할 닉네임" /></label></>}<button className="auth-local-submit" type="submit" disabled={register.isPending || localLogin.isPending}>{register.isPending || localLogin.isPending ? '처리 중...' : mode === 'register' ? '회원가입하기' : '로그인하기'} <LockKeyhole size={15} /></button><button className="auth-local-back" type="button" onClick={() => setMode('social')}><UserRound size={14} /> 다른 로그인 방법 보기</button></form>}
      <p className="auth-dialog-note">소셜 로그인과 자체 계정은 안전하게 별도로 관리됩니다.</p>
    </section>
  </div>;
}
