import { useState, useRef, useEffect, useCallback } from 'react';
import { AlbaLoginHero } from '@/components/ui/Logo';
import { supabase } from '@/lib/supabase';
import { getDeviceHash, getDeviceName, getBrowserName, maskEmail } from '@/lib/deviceFingerprint';
import { cn } from '@/lib/utils';

interface Verification2FAProps {
  email: string;
  prenom: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 60;
const EXPIRY_SECONDS = 10 * 60;

export function Verification2FA({ email, prenom, onSuccess, onCancel }: Verification2FAProps) {
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN);
  const [expirySeconds, setExpirySeconds] = useState(EXPIRY_SECONDS);
  const [remember, setRemember] = useState(true);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  useEffect(() => {
    if (expirySeconds <= 0) return;
    const t = setInterval(() => setExpirySeconds((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [expirySeconds]);

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const updateDigit = useCallback((index: number, value: string) => {
    setError(null);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    if (value && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }, []);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [digits]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!pasted) return;
    setError(null);
    const newDigits = Array(CODE_LENGTH).fill('');
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setDigits(newDigits);
    const focusIdx = Math.min(pasted.length, CODE_LENGTH - 1);
    inputRefs.current[focusIdx]?.focus();
  }, []);

  const code = digits.join('');
  const isComplete = code.length === CODE_LENGTH && digits.every((d) => d !== '');

  const handleVerify = async () => {
    if (!isComplete || verifying) return;
    setVerifying(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc('verifier_code_2fa', {
      p_email: email,
      p_code: code,
    });

    if (rpcError) {
      setError('Erreur de verification. Reessayez.');
      setVerifying(false);
      return;
    }

    const result = data as { success: boolean; reason?: string };

    if (!result.success) {
      if (result.reason === 'blocked') {
        setError('Trop de tentatives. Reessayez dans 15 minutes.');
      } else {
        setError('Code incorrect');
      }
      setDigits(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
      setVerifying(false);
      return;
    }

    if (remember) {
      const deviceHash = getDeviceHash();
      await supabase.rpc('enregistrer_device', {
        p_device_hash: deviceHash,
        p_nom_device: getDeviceName(),
        p_navigateur: getBrowserName(),
      });
    }

    onSuccess();
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setResendMsg(null);
    setError(null);

    await supabase
      .from('codes_2fa')
      .update({ utilise: true })
      .eq('email', email)
      .eq('utilise', false);

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();

    await supabase.from('codes_2fa').insert({ email, code: newCode });

    await supabase.functions.invoke('send-code-2fa', {
      body: { email, code: newCode, prenom },
    });

    setDigits(Array(CODE_LENGTH).fill(''));
    setResendCooldown(RESEND_COOLDOWN);
    setExpirySeconds(EXPIRY_SECONDS);
    setResendMsg('Nouveau code envoye');
    inputRefs.current[0]?.focus();

    setTimeout(() => setResendMsg(null), 4000);
  };

  return (
    <div className="min-h-screen bg-bg-app text-text flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8 md:mb-10">
          <AlbaLoginHero />
        </div>

        <div className="bg-bg-card rounded-2xl p-5 md:p-6 flex flex-col items-center gap-5">
          <div className="text-center">
            <h1 className="text-xl font-semibold mb-2">Verification de securite</h1>
            <p className="text-[13px] text-dim leading-relaxed">
              Un code a 6 chiffres a ete envoye a{' '}
              <span className="text-nikito-cyan font-medium">{maskEmail(email)}</span>
            </p>
          </div>

          <div className="flex gap-2.5" onPaste={handlePaste}>
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(-1);
                  updateDigit(i, v);
                }}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className={cn(
                  'w-[46px] h-[58px] rounded-xl bg-bg-deep text-center text-2xl font-bold font-mono text-nikito-cyan outline-none transition-colors',
                  digit
                    ? 'border-2 border-nikito-cyan/60'
                    : 'border border-white/[0.12] focus:border-nikito-cyan/40'
                )}
              />
            ))}
          </div>

          {error && (
            <div className="bg-red/10 border border-red/30 text-red text-xs p-3 rounded-lg w-full text-center">
              {error}
            </div>
          )}

          {resendMsg && (
            <div className="bg-green/10 border border-green/30 text-green text-xs p-3 rounded-lg w-full text-center">
              {resendMsg}
            </div>
          )}

          <div className="text-[12px] text-dim">
            {expirySeconds > 0 ? (
              <>Ce code expire dans <span className="text-text font-medium">{formatCountdown(expirySeconds)}</span></>
            ) : (
              <span className="text-red">Code expire. Renvoyez un nouveau code.</span>
            )}
          </div>

          <button
            onClick={handleVerify}
            disabled={!isComplete || verifying || expirySeconds === 0}
            className={cn(
              'w-full bg-gradient-cta text-text py-3.5 rounded-xl text-sm font-bold min-h-[44px]',
              (!isComplete || verifying || expirySeconds === 0) && 'opacity-50 cursor-not-allowed'
            )}
          >
            {verifying ? 'Verification...' : 'Verifier'}
          </button>

          <label className="flex items-center gap-2.5 cursor-pointer self-start">
            <button
              type="button"
              onClick={() => setRemember(!remember)}
              className={cn(
                'w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors',
                remember
                  ? 'bg-nikito-cyan border-nikito-cyan'
                  : 'bg-transparent border-white/20'
              )}
            >
              {remember && (
                <svg className="w-3 h-3 text-bg-app" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <span className="text-[13px] text-dim">Se souvenir de cet appareil pendant 14 jours</span>
          </label>

          <div className="flex items-center justify-between w-full pt-1">
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className={cn(
                'text-[13px] underline transition-colors',
                resendCooldown > 0 ? 'text-faint cursor-not-allowed' : 'text-nikito-cyan hover:text-nikito-cyan/80'
              )}
            >
              {resendCooldown > 0 ? `Renvoyer le code (${resendCooldown}s)` : 'Renvoyer le code'}
            </button>

            <button
              onClick={onCancel}
              className="text-[13px] text-dim hover:text-text transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
