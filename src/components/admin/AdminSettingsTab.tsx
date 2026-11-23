import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Facebook,
  Globe,
  Instagram,
  Loader2,
  RefreshCw,
  Save,
  Share2,
  ShieldCheck,
} from 'lucide-react';
import { fetchAdminDiagnostics, saveAdminSettings } from '../../api/admin';
import type { AdminDiagnostics, StorefrontSettings } from '../../types/admin';

interface AdminSettingsTabProps {
  settings: StorefrontSettings | null;
  onSettingsSaved: (updated: StorefrontSettings) => void;
}

export const AdminSettingsTab: React.FC<AdminSettingsTabProps> = ({
  settings,
  onSettingsSaved,
}) => {
  const [diagnostics, setDiagnostics] = useState<AdminDiagnostics | null>(null);
  const [testingWc, setTestingWc] = useState(false);
  const [diagError, setDiagError] = useState<string | null>(null);

  const [supportEmail, setSupportEmail] = useState(
    settings?.supportEmail || 'support@fiftydollarshop.com'
  );
  const [announcementText, setAnnouncementText] = useState(
    settings?.announcementText || ''
  );
  const [instagramUrl, setInstagramUrl] = useState(
    settings?.instagramUrl || 'https://www.instagram.com/fifty_dollar_shop/'
  );
  const [facebookUrl, setFacebookUrl] = useState(
    settings?.facebookUrl || 'https://www.facebook.com/fiftydollarshop'
  );
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setSupportEmail(settings.supportEmail);
      setAnnouncementText(settings.announcementText);
      setInstagramUrl(settings.instagramUrl);
      setFacebookUrl(settings.facebookUrl);
    }
  }, [settings]);

  const runDiagnostics = async () => {
    setTestingWc(true);
    setDiagError(null);
    try {
      const res = await fetchAdminDiagnostics();
      setDiagnostics(res);
    } catch (err) {
      setDiagError(
        err instanceof Error
          ? err.message
          : 'Unable to run live diagnostics right now.'
      );
    } finally {
      setTestingWc(false);
    }
  };

  useEffect(() => {
    void runDiagnostics();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const res = await saveAdminSettings({
        supportEmail,
        announcementText,
        instagramUrl,
        facebookUrl,
      });
      onSettingsSaved(res.settings);
      setSaveMessage('Storefront info updated and synced to live header & footer.');
      window.setTimeout(() => setSaveMessage(null), 4000);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Unable to save storefront settings.'
      );
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="pb-6 border-b border-[#E2E5EC]">
        <p className="text-[12px] font-mono text-[#5A6275] mb-1">
          System Health &amp; Storefront Configuration
        </p>
        <h1 className="font-heading font-bold text-[26px] sm:text-[30px] text-[#0B0F19] leading-tight">
          Settings &amp; Integrations
        </h1>
      </div>

      {/* 1. WooCommerce Connection Diagnostics */}
      <div className="bg-white rounded-2xl border border-[#E2E5EC] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-5 border-b border-[#E2E5EC]">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F4F5F8] border border-[#E2E5EC] flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5 text-[#122B5C]" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-[16.5px] text-[#0B0F19]">
                WooCommerce Connection Diagnostics
              </h2>
              <p className="text-[13px] text-[#5A6275]">
                Verifies live Store API / REST proxy connectivity, round-trip
                latency, and JSON catalog responses.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void runDiagnostics()}
            disabled={testingWc}
            className="h-10 px-4 rounded-xl bg-[#0B0F19] hover:bg-[#E54826] disabled:opacity-60 text-white text-[13px] font-heading font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw
              className={`w-4 h-4 ${testingWc ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Run Live Connectivity Test</span>
          </button>
        </div>

        {diagError && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-[13.5px] text-red-700 flex items-center gap-2.5 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{diagError}</span>
          </div>
        )}

        {diagnostics ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl bg-[#F4F5F8] border border-[#E2E5EC] p-4">
              <p className="text-[12px] text-[#5A6275] mb-1">Proxy Status</p>
              <p
                className={`font-heading font-bold text-[16px] flex items-center gap-1.5 ${
                  diagnostics.woocommerce.connected
                    ? 'text-[#16A34A]'
                    : 'text-[#DC2626]'
                }`}
              >
                {diagnostics.woocommerce.connected ? (
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <AlertCircle className="w-4 h-4" aria-hidden="true" />
                )}
                <span>
                  {diagnostics.woocommerce.connected
                    ? 'Connected'
                    : 'Unreachable'}
                </span>
              </p>
              <p className="text-[11.5px] font-mono text-[#5A6275] mt-1">
                Mode: {diagnostics.woocommerce.mode}
              </p>
            </div>

            <div className="rounded-xl bg-[#F4F5F8] border border-[#E2E5EC] p-4">
              <p className="text-[12px] text-[#5A6275] mb-1">API Latency</p>
              <p className="font-mono font-bold text-[22px] text-[#0B0F19] tabular-nums">
                {diagnostics.woocommerce.latencyMs} ms
              </p>
              <p className="text-[11.5px] font-mono text-[#5A6275] mt-1">
                Checked{' '}
                {new Date(diagnostics.checkedAt).toLocaleTimeString()}
              </p>
            </div>

            <div className="rounded-xl bg-[#F4F5F8] border border-[#E2E5EC] p-4">
              <p className="text-[12px] text-[#5A6275] mb-1">
                Live Products Confirmed
              </p>
              <p className="font-mono font-bold text-[22px] text-[#0B0F19] tabular-nums">
                {diagnostics.woocommerce.productCount}
              </p>
              <p className="text-[11.5px] text-[#5A6275] mt-1">
                JSON payload validated
              </p>
            </div>

            <div className="rounded-xl bg-[#F4F5F8] border border-[#E2E5EC] p-4">
              <p className="text-[12px] text-[#5A6275] mb-1">
                Live Categories Confirmed
              </p>
              <p className="font-mono font-bold text-[22px] text-[#0B0F19] tabular-nums">
                {diagnostics.woocommerce.categoryCount}
              </p>
              <p className="text-[11.5px] font-mono text-[#5A6275] mt-1 truncate">
                {diagnostics.woocommerce.storeOrigin}
              </p>
            </div>
          </div>
        ) : (
          <div className="h-24 rounded-xl bg-[#F4F5F8] animate-pulse" />
        )}
      </div>

      {/* 2. Payment Gateway Status + Meta Commerce Readiness (2-col split) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Gateway Read-Only Status */}
        <div className="bg-white rounded-2xl border border-[#E2E5EC] p-6">
          <div className="flex items-start gap-3 pb-4 mb-4 border-b border-[#E2E5EC]">
            <div className="w-10 h-10 rounded-xl bg-[#F4F5F8] border border-[#E2E5EC] flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5 text-[#122B5C]" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-[16px] text-[#0B0F19]">
                Payment Gateway Status
              </h2>
              <p className="text-[13px] text-[#5A6275]">
                Read-only server environment indicators (no secrets displayed)
              </p>
            </div>
          </div>

          <div className="space-y-3 text-[13.5px]">
            <div className="flex items-center justify-between py-2.5 border-b border-[#E2E5EC]">
              <span className="text-[#5A6275]">WooCommerce Checkout Proxy</span>
              <span className="font-mono font-semibold text-[#16A34A]">
                Active
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5 border-b border-[#E2E5EC]">
              <span className="text-[#5A6275]">Direct Stripe Server Key</span>
              <span className="font-mono font-semibold text-[#0B0F19]">
                {diagnostics?.paymentGateway.stripeConfigured
                  ? `Configured (${diagnostics.paymentGateway.stripeMode})`
                  : 'Managed via WooCommerce'}
              </span>
            </div>
            <div className="flex items-start gap-2 pt-2 text-[12.5px] text-[#5A6275]">
              <ShieldCheck
                className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>
                All API secrets remain strictly inside server environment
                variables. Configure keys via hosting environment settings only.
              </span>
            </div>
          </div>
        </div>

        {/* Meta Commerce Readiness Panel */}
        <div className="bg-white rounded-2xl border border-[#E2E5EC] p-6">
          <div className="flex items-start gap-3 pb-4 mb-4 border-b border-[#E2E5EC]">
            <div className="w-10 h-10 rounded-xl bg-[#F4F5F8] border border-[#E2E5EC] flex items-center justify-center shrink-0">
              <Share2 className="w-5 h-5 text-[#122B5C]" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-[16px] text-[#0B0F19]">
                Meta Commerce &amp; Shop Sync
              </h2>
              <p className="text-[13px] text-[#5A6275]">
                Server-side Graph API{' '}
                {diagnostics?.metaCommerce.graphApiVersion || 'v22.0'} catalog
                &amp; shop sync status
              </p>
            </div>
          </div>

          <div className="space-y-2.5 text-[13.5px]">
            <div className="flex items-center justify-between py-2 border-b border-[#E2E5EC] gap-3">
              <span className="text-[#5A6275] shrink-0">
                Storefront Base URL
              </span>
              <span className="font-mono text-[12.5px] font-semibold text-[#0B0F19] truncate">
                {diagnostics?.metaCommerce.storefrontBaseUrl ||
                  'https://www.fiftydollarshop.com/'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[#E2E5EC]">
              <span className="text-[#5A6275]">Meta Sync Status</span>
              <span
                className={`font-mono font-semibold ${
                  diagnostics?.metaCommerce.status === 'configured'
                    ? 'text-[#16A34A]'
                    : 'text-[#D97706]'
                }`}
              >
                {diagnostics?.metaCommerce.status === 'configured'
                  ? 'Connected & Active'
                  : 'Set Env Vars to Sync'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[#E2E5EC]">
              <span className="text-[#5A6275]">
                Catalog ID &amp; Access Token
              </span>
              <span className="font-mono text-[12px] font-semibold text-[#0B0F19]">
                {diagnostics?.metaCommerce.catalogIdConfigured &&
                diagnostics?.metaCommerce.accessTokenConfigured
                  ? 'Configured on Server'
                  : 'Missing Server Env'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[#E2E5EC]">
              <span className="text-[#5A6275]">
                Business / Commerce / Shop IDs
              </span>
              <span className="font-mono text-[12px] text-[#5A6275]">
                {[
                  diagnostics?.metaCommerce.businessIdConfigured
                    ? 'Business ✓'
                    : 'Business —',
                  diagnostics?.metaCommerce.commerceAccountIdConfigured
                    ? 'Commerce ✓'
                    : 'Commerce —',
                  diagnostics?.metaCommerce.storefrontIdConfigured
                    ? 'Shop ✓'
                    : 'Shop —',
                ].join(' · ')}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[#E2E5EC] gap-3">
              <span className="text-[#5A6275] inline-flex items-center gap-1.5 shrink-0">
                <Instagram className="w-3.5 h-3.5 text-[#0B0F19]" aria-hidden="true" />
                <span>Instagram Profile</span>
              </span>
              {instagramUrl ? (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[12px] font-semibold text-[#122B5C] hover:text-[#E54826] inline-flex items-center gap-1 truncate"
                >
                  <span className="truncate">@fifty_dollar_shop</span>
                  <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                </a>
              ) : (
                <span className="font-mono text-[12px] text-[#5A6275]">Not set</span>
              )}
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[#E2E5EC] gap-3">
              <span className="text-[#5A6275] inline-flex items-center gap-1.5 shrink-0">
                <Facebook className="w-3.5 h-3.5 text-[#0B0F19]" aria-hidden="true" />
                <span>Facebook Page</span>
              </span>
              {facebookUrl ? (
                <a
                  href={facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[12px] font-semibold text-[#122B5C] hover:text-[#E54826] inline-flex items-center gap-1 truncate"
                >
                  <span className="truncate">/fiftydollarshop</span>
                  <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                </a>
              ) : (
                <span className="font-mono text-[12px] text-[#5A6275]">Not set</span>
              )}
            </div>
            <p className="text-[12.5px] text-[#5A6275] pt-1">
              Sync individual products, re-sync edits in-place, or run Bulk Sync
              All from the WooCommerce Products tab. Meta access tokens stay
              strictly on the server.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Editable Storefront Info */}
      <div className="bg-white rounded-2xl border border-[#E2E5EC] p-6">
        <div className="flex items-start gap-3 pb-4 mb-5 border-b border-[#E2E5EC]">
          <div className="w-10 h-10 rounded-xl bg-[#F4F5F8] border border-[#E2E5EC] flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5 text-[#122B5C]" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-[16.5px] text-[#0B0F19]">
              Storefront Info
            </h2>
            <p className="text-[13px] text-[#5A6275]">
              Update public storefront announcement text, support email, and
              social links without touching WooCommerce catalog pricing.
            </p>
          </div>
        </div>

        {saveError && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[13.5px] text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{saveError}</span>
          </div>
        )}
        {saveMessage && (
          <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-[13.5px] text-[#15803D] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#16A34A]" />
            <span>{saveMessage}</span>
          </div>
        )}

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="settings-support-email"
                className="block text-[13px] font-semibold text-[#0B0F19] mb-1.5"
              >
                USA Support Email
              </label>
              <input
                id="settings-support-email"
                type="email"
                required
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                className="w-full h-10 px-3.5 rounded-xl border border-[#E2E5EC] bg-[#F4F5F8] focus:bg-white text-[13.5px] text-[#0B0F19] focus:outline-2 focus:outline-[#0B0F19]"
              />
            </div>

            <div>
              <label
                htmlFor="settings-announcement"
                className="block text-[13px] font-semibold text-[#0B0F19] mb-1.5"
              >
                Top Announcement Bar Text
              </label>
              <input
                id="settings-announcement"
                type="text"
                maxLength={180}
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                className="w-full h-10 px-3.5 rounded-xl border border-[#E2E5EC] bg-[#F4F5F8] focus:bg-white text-[13.5px] text-[#0B0F19] focus:outline-2 focus:outline-[#0B0F19]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="settings-instagram"
                  className="text-[13px] font-semibold text-[#0B0F19] inline-flex items-center gap-1.5"
                >
                  <Instagram className="w-3.5 h-3.5 text-[#5A6275]" aria-hidden="true" />
                  <span>Instagram Profile URL</span>
                </label>
                {instagramUrl && (
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] font-semibold text-[#122B5C] hover:text-[#E54826] inline-flex items-center gap-1"
                  >
                    <span>Open</span>
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                )}
              </div>
              <input
                id="settings-instagram"
                type="url"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                placeholder="https://www.instagram.com/fifty_dollar_shop/"
                className="w-full h-10 px-3.5 rounded-xl border border-[#E2E5EC] bg-[#F4F5F8] focus:bg-white text-[13.5px] text-[#0B0F19] focus:outline-2 focus:outline-[#0B0F19]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="settings-facebook"
                  className="text-[13px] font-semibold text-[#0B0F19] inline-flex items-center gap-1.5"
                >
                  <Facebook className="w-3.5 h-3.5 text-[#5A6275]" aria-hidden="true" />
                  <span>Facebook Page URL</span>
                </label>
                {facebookUrl && (
                  <a
                    href={facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] font-semibold text-[#122B5C] hover:text-[#E54826] inline-flex items-center gap-1"
                  >
                    <span>Open</span>
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                )}
              </div>
              <input
                id="settings-facebook"
                type="url"
                value={facebookUrl}
                onChange={(e) => setFacebookUrl(e.target.value)}
                placeholder="https://www.facebook.com/fiftydollarshop"
                className="w-full h-10 px-3.5 rounded-xl border border-[#E2E5EC] bg-[#F4F5F8] focus:bg-white text-[13.5px] text-[#0B0F19] focus:outline-2 focus:outline-[#0B0F19]"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end">
            <button
              type="submit"
              disabled={savingSettings}
              className="h-10 px-5 rounded-xl bg-[#0B0F19] hover:bg-[#E54826] disabled:opacity-60 text-white text-[13.5px] font-heading font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              {savingSettings ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="w-4 h-4" aria-hidden="true" />
              )}
              <span>Save Storefront Info</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
