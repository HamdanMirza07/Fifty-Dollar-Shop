import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { loginAdmin, setupAdminPassword } from '../../api/admin';
import type { AdminAuthStatus } from '../../types/admin';

interface AdminLoginScreenProps {
  authStatus: AdminAuthStatus;
  onAuthenticated: () => void;
  onExitToStorefront: () => void;
}

export const AdminLoginScreen: React.FC<AdminLoginScreenProps> = ({
  authStatus,
  onAuthenticated,
  onExitToStorefront,
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSetup = authStatus.needsSetup;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isSetup) {
      if (password.trim().length < 8) {
        setError('Choose a password with at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please verify and try again.');
        return;
      }
      setSubmitting(true);
      try {
        await setupAdminPassword(password);
        setPassword('');
        setConfirmPassword('');
        onAuthenticated();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to complete admin setup.'
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!password.trim()) {
      setError('Enter your admin password or access token.');
      return;
    }

    setSubmitting(true);
    try {
      await loginAdmin(password);
      setPassword('');
      onAuthenticated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Invalid admin credentials.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F5F8] text-[#0B0F19] flex flex-col">
      {/* Top Bar */}
      <header className="h-16 bg-white border-b border-[#E2E5EC] px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="h-9 w-10 rounded-lg bg-[#F4F5F8] border border-[#E2E5EC] p-1 flex items-center justify-center shrink-0">
            <img
              src="/assets/aistudio/Glossy_Navy_Shopping_Bag_with_Golden_50_36b56e7c.png"
              alt="Fifty Dollar Shop"
              className="w-full h-full object-contain"
            />
          </span>
          <span className="font-heading font-bold text-[15px] text-[#0B0F19] whitespace-nowrap">
            Fifty Dollar Shop Admin
          </span>
        </div>

        <button
          type="button"
          onClick={onExitToStorefront}
          className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[#5A6275] hover:text-[#0B0F19] transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Storefront</span>
        </button>
      </header>

      {/* Main Centered Auth Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[440px] bg-white rounded-2xl border border-[#E2E5EC] p-7 sm:p-9"
        >
          <div className="w-11 h-11 rounded-xl bg-[#0B0F19] text-white flex items-center justify-center mb-5">
            {isSetup ? (
              <KeyRound className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Lock className="w-5 h-5" aria-hidden="true" />
            )}
          </div>

          <p className="text-[12px] font-mono text-[#5A6275] mb-1">
            {isSetup ? 'First-Run Admin Setup' : 'Store Operations Console'}
          </p>
          <h1 className="font-heading font-bold text-[24px] leading-tight text-[#0B0F19] mb-2">
            {isSetup ? 'Claim Admin Access' : 'Sign in to Admin Panel'}
          </h1>
          <p className="text-[14px] text-[#5A6275] leading-relaxed mb-6">
            {isSetup
              ? 'No server ADMIN_SECRET_TOKEN is set yet. Create your admin password below to lock this console and start managing your live WooCommerce catalog.'
              : authStatus.mode === 'env'
                ? 'Verify with your configured server admin token to access live WooCommerce catalog controls, orders, and diagnostics.'
                : 'Sign in with your admin password to manage live WooCommerce catalog placement, orders, and storefront settings.'}
          </p>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-2.5 text-[13.5px] text-red-700"
            >
              <AlertCircle
                className="w-4 h-4 shrink-0 mt-0.5 text-red-600"
                aria-hidden="true"
              />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="admin-password-input"
                className="block text-[13px] font-semibold text-[#0B0F19] mb-1.5"
              >
                {isSetup
                  ? 'New Admin Password (min 8 characters)'
                  : authStatus.mode === 'env'
                    ? 'Admin Access Token'
                    : 'Admin Password'}
              </label>
              <div className="relative">
                <input
                  id="admin-password-input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isSetup ? 'new-password' : 'current-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    isSetup
                      ? 'Create a strong admin password'
                      : 'Enter admin credential'
                  }
                  className="w-full h-11 pl-3.5 pr-11 rounded-xl border border-[#E2E5EC] bg-[#F4F5F8] focus:bg-white text-[14px] text-[#0B0F19] focus:outline-2 focus:outline-[#0B0F19] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-[#5A6275] hover:text-[#0B0F19] cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {isSetup && (
              <div>
                <label
                  htmlFor="admin-confirm-password-input"
                  className="block text-[13px] font-semibold text-[#0B0F19] mb-1.5"
                >
                  Confirm Admin Password
                </label>
                <input
                  id="admin-confirm-password-input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your admin password"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#E2E5EC] bg-[#F4F5F8] focus:bg-white text-[14px] text-[#0B0F19] focus:outline-2 focus:outline-[#0B0F19] transition-colors"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-xl bg-[#0B0F19] hover:bg-[#E54826] disabled:opacity-60 text-white font-heading font-semibold text-[14px] inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>{isSetup ? 'Securing Console...' : 'Verifying...'}</span>
                </>
              ) : (
                <span>
                  {isSetup ? 'Set Password & Open Admin' : 'Sign In'}
                </span>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-[#E2E5EC] flex items-start gap-2.5 text-[12.5px] text-[#5A6275]">
            <ShieldCheck
              className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <p className="leading-relaxed">
              Server-verified session. Backend WooCommerce and payment keys stay
              strictly on the server and are never exposed in browser storage.
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
};
