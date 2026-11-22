import { LockKeyhole, UserRound, X } from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

export function AuthDialog({ onClose, onAuthenticated }: { onClose: () => void; onAuthenticated: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
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
  const pending = register.isPending || localLogin.isPending;
  return <div className="auth-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title">
      <button type="button" className="auth-dialog-close" onClick={onClose} aria-label="인증 창 닫기"><X size={21} /></button>
      <div className="auth-dialog-mark"><img src="/logo.svg" alt="" /></div>
      <span className="auth-dialog-eyebrow">MOA ACCOUNT</span>
      <h2 id="auth-dialog-title">{mode === 'register' ? <>모아 계정을<br />만들어 보세요</> : <>다시 만나서<br />반가워요</>}</h2>
      <p className="auth-dialog-subtitle">SMS 인증 없이 아이디와 비밀번호로 이용할 수 있어요</p>
      <form className="auth-local-form" onSubmit={submit}><label>아이디<input required minLength={4} maxLength={40} value={loginId} onChange={event => setLoginId(event.target.value)} placeholder="영문·숫자 4자 이상" autoComplete="username" /></label><label>비밀번호<input required minLength={8} maxLength={128} type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="8자 이상" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} /></label>{mode === 'register' && <><label>이름<input required maxLength={40} value={name} onChange={event => setName(event.target.value)} placeholder="이름을 입력해 주세요" /></label><label>닉네임<input required maxLength={40} value={nickname} onChange={event => setNickname(event.target.value)} placeholder="게시판에 표시할 닉네임" /></label></>}<button className="auth-local-submit" type="submit" disabled={pending}>{pending ? '처리 중...' : mode === 'register' ? '회원가입하기' : '로그인하기'} <LockKeyhole size={15} /></button><button className="auth-local-back" type="button" onClick={() => setMode(mode === 'register' ? 'login' : 'register')}><UserRound size={14} /> {mode === 'register' ? '로그인으로 돌아가기' : '처음이라면 회원가입하기'}</button></form>
      <p className="auth-dialog-note">모아 계정은 안전하게 암호화되어 관리됩니다.</p>
    </section>
  </div>;
}
