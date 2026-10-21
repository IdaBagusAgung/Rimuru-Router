import {
  Cpu,
  Flame,
  Info,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  Zap,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Button } from "../../components/ui/button";
import { Card, CardBody, CardHeader } from "../../components/ui/card";
import { ErrorState, LoadingState } from "../../components/ui/state";
import { Switch } from "../../components/ui/switch";
import { Badge } from "../../components/ui/badge";
import { getErrorMessage } from "../../data/api";
import { toast } from "../../lib/toast";
import {
  useProviderAccounts,
  useProviders,
  useRecoverAccount,
  useRecoverAllAccounts,
} from "../../hooks/providers";
import { useRuntimeSettings, useUpdateRuntimeSettings } from "../../hooks/settings";
import type { ProviderAccountResponse } from "../../data/contracts";

/** Displays accounts for a specific provider in the Cooling & Bypass live view */
function ProviderAccountsList({
  providerId,
  providerName,
  onRecoverAccount,
  isRecovering,
}: {
  providerId: string;
  providerName: string;
  onRecoverAccount: (providerId: string, accountId: string) => void;
  isRecovering: boolean;
}): ReactNode {
  const { data: accounts, isLoading } = useProviderAccounts(providerId);

  if (isLoading) {
    return (
      <div className="py-3 px-4 text-xs text-text-tertiary">
        Loading accounts for {providerName}…
      </div>
    );
  }

  if (!accounts || accounts.length === 0) {
    return (
      <div className="py-3 px-4 text-xs text-text-tertiary">
        No accounts configured for {providerName}.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border-subtle">
      {accounts.map((acc: ProviderAccountResponse) => {
        const isCooldown = acc.status === "cooldown";
        const hasModelCooldowns =
          acc.modelCooldowns && Object.keys(acc.modelCooldowns).length > 0;
        const cooldownModels = acc.modelCooldowns
          ? Object.keys(acc.modelCooldowns)
          : [];

        return (
          <div
            key={acc.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-hover/30 transition-colors"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-text-primary">
                  {acc.label || acc.id}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-hover text-text-secondary border border-border-subtle">
                  {providerName}
                </span>
                {acc.status === "active" && !hasModelCooldowns ? (
                  <Badge tone="ok" className="text-xs">
                    Active
                  </Badge>
                ) : isCooldown ? (
                  <Badge tone="warn" className="text-xs animate-pulse">
                    Account Cooldown
                  </Badge>
                ) : (
                  <Badge tone="warn" className="text-xs">
                    {cooldownModels.length} Model Cooldown(s)
                  </Badge>
                )}
              </div>
              <div className="text-xs text-text-tertiary space-y-0.5">
                <div className="flex items-center gap-3">
                  <span>Failures: {acc.consecutiveFailures ?? 0}</span>
                  {acc.cooldownUntil && (
                    <span>
                      Until: {new Date(acc.cooldownUntil).toLocaleTimeString()}
                    </span>
                  )}
                  {acc.lastRecoveredAt && (
                    <span>
                      Recovered:{" "}
                      {new Date(acc.lastRecoveredAt).toLocaleTimeString()}
                    </span>
                  )}
                </div>
                {acc.lastError && (
                  <p className="text-xs text-amber-400 font-mono line-clamp-1">
                    Last: {acc.lastError}
                  </p>
                )}
                {hasModelCooldowns && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-text-secondary">Cooling models:</span>
                    {cooldownModels.map((m) => (
                      <span
                        key={m}
                        className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 text-[11px] font-mono border border-amber-500/20"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              {(isCooldown || hasModelCooldowns || (acc.consecutiveFailures ?? 0) > 0) && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isRecovering}
                  onClick={() => onRecoverAccount(providerId, acc.id)}
                  className="text-xs flex items-center gap-1.5 border-amber-500/30 hover:border-amber-500/60 text-amber-300 hover:bg-amber-500/10"
                >
                  <RotateCcw size={12} />
                  Reset & Recover
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function CoolingPage(): ReactNode {
  const query = useRuntimeSettings();
  const mutation = useUpdateRuntimeSettings();
  const recoverAllMutation = useRecoverAllAccounts();
  const recoverSingleMutation = useRecoverAccount();
  const { data: providers, isLoading: providersLoading } = useProviders();

  const settings = query.data;

  // Filter providers that have accounts configured
  const activeProviders = useMemo(() => {
    if (!providers) return [];
    // Prioritize CodeBuddy variants at top
    return [...providers].sort((a, b) => {
      const aIsBuddy = a.providerId === "cb" || a.providerId === "cbcn";
      const bIsBuddy = b.providerId === "cb" || b.providerId === "cbcn";
      if (aIsBuddy && !bIsBuddy) return -1;
      if (!aIsBuddy && bIsBuddy) return 1;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [providers]);

  if (query.isPending || providersLoading) {
    return <LoadingState label="Loading cooling settings and account states…" />;
  }

  if (query.isError || !settings) {
    return (
      <ErrorState
        message={getErrorMessage(query.error, "Failed to load runtime cooling settings")}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const cooldownSystemEnabled = settings.cooldownSystemEnabled !== false;
  const codebuddyEndlessMode = settings.codebuddyEndlessMode !== false;
  const autoRecoveryEnabled = settings.autoRecoveryEnabled !== false;

  const handleToggleCooldownSystem = (checked: boolean) => {
    mutation.mutate(
      { cooldownSystemEnabled: checked },
      {
        onSuccess: () => {
          toast.success(
            checked
              ? "Cooldown system activated"
              : "Cooldown system deactivated — Bypass mode active!",
          );
        },
        onError: (err) => {
          toast.error(getErrorMessage(err, "Failed to update cooling system switch"));
        },
      },
    );
  };

  const handleToggleCodebuddyEndless = (checked: boolean) => {
    mutation.mutate(
      { codebuddyEndlessMode: checked },
      {
        onSuccess: () => {
          toast.success(
            checked
              ? "CodeBuddy Endless Mode enabled (Zero Cooldown active)"
              : "CodeBuddy Endless Mode disabled",
          );
        },
        onError: (err) => {
          toast.error(getErrorMessage(err, "Failed to update CodeBuddy mode"));
        },
      },
    );
  };

  const handleToggleAutoRecovery = (checked: boolean) => {
    mutation.mutate(
      { autoRecoveryEnabled: checked },
      {
        onSuccess: () => {
          toast.success(
            checked
              ? "Auto-recovery background engine active"
              : "Auto-recovery background engine disabled",
          );
        },
        onError: (err) => {
          toast.error(getErrorMessage(err, "Failed to update auto-recovery"));
        },
      },
    );
  };

  const handleRecoverAll = (providerId?: string) => {
    recoverAllMutation.mutate(providerId ? { providerId } : undefined);
  };

  const handleRecoverSingle = (providerId: string, accountId: string) => {
    recoverSingleMutation.mutate({ providerId, accountId });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Hero Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-gradient-to-r from-surface-primary via-surface-secondary to-surface-primary p-6 sm:p-8 shadow-xl">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                <Flame size={26} className="animate-pulse" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
                  Cooling & Lockout Bypass
                  <Badge
                    tone={!cooldownSystemEnabled ? "warn" : codebuddyEndlessMode ? "ok" : "default"}
                    className="text-xs uppercase tracking-wider"
                  >
                    {!cooldownSystemEnabled
                      ? "System Bypass Active"
                      : codebuddyEndlessMode
                      ? "CodeBuddy Endless Active"
                      : "Standard Cooldowns"}
                  </Badge>
                </h1>
                <p className="text-sm text-text-tertiary">
                  Switch off cooldown restrictions and let CodeBuddy and your accounts execute continuously without lockouts.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="secondary"
              size="md"
              disabled={recoverAllMutation.isPending}
              onClick={() => handleRecoverAll("cb")}
              className="border-amber-500/30 hover:border-amber-500/60 text-amber-300 hover:bg-amber-500/10 flex items-center gap-2"
            >
              <Zap size={15} />
              Reset CodeBuddy
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={recoverAllMutation.isPending}
              onClick={() => handleRecoverAll()}
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/20 flex items-center gap-2 border-0"
            >
              <RotateCcw size={15} className={recoverAllMutation.isPending ? "animate-spin" : ""} />
              {recoverAllMutation.isPending ? "Recovering…" : "Recover All Accounts"}
            </Button>
          </div>
        </div>
      </div>

      {/* Mode Status Pill Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`p-4 rounded-xl border transition-all ${!cooldownSystemEnabled ? "bg-amber-500/10 border-amber-500/30 shadow-md shadow-amber-500/5" : "bg-surface-secondary border-border-subtle"}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
              System Cooldown
            </span>
            {!cooldownSystemEnabled ? (
              <ShieldOff size={16} className="text-amber-400" />
            ) : (
              <ShieldCheck size={16} className="text-emerald-400" />
            )}
          </div>
          <p className="text-lg font-bold text-text-primary mt-1">
            {!cooldownSystemEnabled ? "BYPASSED (OFF)" : "Active (Standard)"}
          </p>
          <p className="text-xs text-text-tertiary mt-0.5">
            {!cooldownSystemEnabled
              ? "All models & accounts never cooldown"
              : "Standard backoff on upstream 429s"}
          </p>
        </div>

        <div className={`p-4 rounded-xl border transition-all ${codebuddyEndlessMode ? "bg-emerald-500/10 border-emerald-500/30 shadow-md shadow-emerald-500/5" : "bg-surface-secondary border-border-subtle"}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
              CodeBuddy Endless Mode
            </span>
            <Sparkles size={16} className={codebuddyEndlessMode ? "text-emerald-400" : "text-text-tertiary"} />
          </div>
          <p className="text-lg font-bold text-text-primary mt-1">
            {codebuddyEndlessMode ? "ENABLED (Zero Cooldown)" : "Disabled"}
          </p>
          <p className="text-xs text-text-tertiary mt-0.5">
            {codebuddyEndlessMode
              ? "CodeBuddy accounts run as long as possible"
              : "Standard daily / rate limit cooldowns"}
          </p>
        </div>

        <div className={`p-4 rounded-xl border transition-all ${autoRecoveryEnabled ? "bg-cyan-500/10 border-cyan-500/30 shadow-md shadow-cyan-500/5" : "bg-surface-secondary border-border-subtle"}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
              Auto-Recovery Engine
            </span>
            <RefreshCw size={16} className={autoRecoveryEnabled ? "text-cyan-400 animate-spin" : "text-text-tertiary"} style={{ animationDuration: "12s" }} />
          </div>
          <p className="text-lg font-bold text-text-primary mt-1">
            {autoRecoveryEnabled ? "Active (Every 5s)" : "Disabled"}
          </p>
          <p className="text-xs text-text-tertiary mt-0.5">
            {autoRecoveryEnabled
              ? "Continuously cleanses stuck cooldowns"
              : "Manual recovery required"}
          </p>
        </div>
      </div>

      {/* Primary Settings Controls */}
      <Card>
        <CardHeader
          title="Bypass & Cooldown Controls"
          subtitle="Configure system-wide cooling bypass and CodeBuddy zero-cooldown behaviors"
          icon={<Flame size={18} className="text-amber-400" />}
        />
        <CardBody className="divide-y divide-border-subtle p-0">
          {/* Master Switch */}
          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1 pr-4">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-text-primary">
                  Cooldown System (Global Master Switch)
                </span>
                {!cooldownSystemEnabled && (
                  <Badge tone="warn" className="text-xs">
                    Bypassed
                  </Badge>
                )}
              </div>
              <p className="text-xs sm:text-sm text-text-tertiary max-w-2xl">
                When switched <strong>OFF</strong>, the entire cooling mechanism is deactivated. Accounts and models are never marked as cooling or excluded from routing, even if an upstream API returns rate limits or error responses. Requests will continue routing without backoffs.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-mono text-text-secondary">
                {cooldownSystemEnabled ? "ENABLED" : "SWITCHED OFF"}
              </span>
              <Switch
                id="toggle-cooldown-system"
                checked={cooldownSystemEnabled}
                onChange={handleToggleCooldownSystem}
                disabled={mutation.isPending}
              />
            </div>
          </div>

          {/* CodeBuddy Endless Mode */}
          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-hover/20">
            <div className="space-y-1 pr-4">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-text-primary">
                  CodeBuddy Endless Mode (Zero Cooldown)
                </span>
                <Badge tone="ok" className="text-xs">
                  Recommended for Coding
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-text-tertiary max-w-2xl">
                Specifically prevents CodeBuddy (<code>cb</code> and <code>cbcn</code>) accounts from entering cooldown or lockout. If an account hits transient limits, RIMURU allows CodeBuddy to immediately continue without stalling Claude Code CLI or OpenCode.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-mono text-text-secondary">
                {codebuddyEndlessMode ? "ENABLED" : "DISABLED"}
              </span>
              <Switch
                id="toggle-codebuddy-endless"
                checked={codebuddyEndlessMode}
                onChange={handleToggleCodebuddyEndless}
                disabled={mutation.isPending}
              />
            </div>
          </div>

          {/* Auto Recovery */}
          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1 pr-4">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-text-primary">
                  Automatic Background Recovery Engine
                </span>
              </div>
              <p className="text-xs sm:text-sm text-text-tertiary max-w-2xl">
                Runs an automated background sweep every 5 seconds to recover any accounts that may have recorded cooldown timestamps or previous error states, keeping them fresh and routable.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-mono text-text-secondary">
                {autoRecoveryEnabled ? "ENABLED" : "DISABLED"}
              </span>
              <Switch
                id="toggle-auto-recovery"
                checked={autoRecoveryEnabled}
                onChange={handleToggleAutoRecovery}
                disabled={mutation.isPending}
              />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Live Accounts Status & Quick Recover */}
      <Card>
        <CardHeader
          title="Account Health & Cooldown Overview"
          subtitle="Real-time status of provider accounts and model cooldown allocations"
          icon={<Cpu size={18} className="text-accent" />}
          action={
            <Button
              size="sm"
              variant="secondary"
              disabled={recoverAllMutation.isPending}
              onClick={() => handleRecoverAll()}
              className="text-xs flex items-center gap-1.5"
            >
              <RotateCcw size={13} className={recoverAllMutation.isPending ? "animate-spin" : ""} />
              Recover All
            </Button>
          }
        />
        <div className="divide-y divide-border-subtle">
          {activeProviders.length === 0 ? (
            <div className="p-6 text-center text-sm text-text-tertiary">
              No providers registered yet.
            </div>
          ) : (
            activeProviders.map((provider) => (
              <div key={provider.providerId} className="border-b last:border-b-0 border-border-subtle">
                <div className="py-2.5 px-4 bg-hover/40 flex items-center justify-between text-xs font-medium text-text-secondary">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-text-primary">{provider.displayName}</span>
                    <span className="font-mono text-[11px] text-text-tertiary">({provider.providerId})</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={recoverAllMutation.isPending}
                    onClick={() => handleRecoverAll(provider.providerId)}
                    className="text-xs text-amber-400 hover:text-amber-300"
                  >
                    Recover {provider.displayName}
                  </Button>
                </div>
                <ProviderAccountsList
                  providerId={provider.providerId}
                  providerName={provider.displayName}
                  onRecoverAccount={handleRecoverSingle}
                  isRecovering={recoverSingleMutation.isPending || recoverAllMutation.isPending}
                />
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Architecture Explanations & Technical Notes */}
      <div className="p-5 rounded-xl border border-border-subtle bg-hover/20 space-y-3">
        <div className="flex items-center gap-2 text-text-primary font-medium text-sm">
          <Info size={16} className="text-teal shrink-0" />
          <span>How RIMURU Zero-Cooldown Execution Works</span>
        </div>
        <div className="text-xs text-text-tertiary space-y-2 leading-relaxed">
          <p>
            • <strong>Route Eligibility Bypass:</strong> When Cooldown System is turned off or CodeBuddy Endless Mode is on, the routing catalog builder suppresses both <code>cooldown</code> and <code>model_cooldown</code> flags. Candidates remain unconditionally eligible for immediate request dispatch.
          </p>
          <p>
            • <strong>Failure Interception:</strong> Instead of advancing accounts into <code>cooldown</code> status and assigning a hours-long <code>cooldownUntil</code> deadline, the failure recorder updates diagnostic messages while maintaining the account in <code>active</code> status.
          </p>
          <p>
            • <strong>Automatic DNS Fallback:</strong> RIMURU includes embedded DNS resolution fallback to ensure connections to <code>www.codebuddy.ai</code> and <code>copilot.tencent.com</code> never get trapped by local sinkholes or network filters.
          </p>
        </div>
      </div>
    </div>
  );
}
