import {
  AlertTriangle,
  Clock,
  Cpu,
  Flame,
  Info,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  refetchInterval,
  codebuddyEndlessMode,
  autoRecoveryIntervalMs,
}: {
  providerId: string;
  providerName: string;
  onRecoverAccount: (providerId: string, accountId: string) => void;
  isRecovering: boolean;
  refetchInterval: number | false;
  codebuddyEndlessMode: boolean;
  autoRecoveryIntervalMs: number;
}): ReactNode {
  const { data: accounts, isLoading } = useProviderAccounts(providerId, { refetchInterval });
  const isBuddy = providerId === "cb" || providerId === "cbcn";

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
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm text-text-primary">
                  {acc.label || acc.id}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-hover text-text-secondary border border-border-subtle">
                  {providerName}
                </span>
                {acc.status === "active" && !hasModelCooldowns ? (
                  isBuddy && codebuddyEndlessMode ? (
                    <Badge tone="ok" className="text-xs flex items-center gap-1 border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                      <Sparkles size={11} />
                      Zero-Cooldown Active
                    </Badge>
                  ) : (
                    <Badge tone="ok" className="text-xs">
                      Active
                    </Badge>
                  )
                ) : isCooldown ? (
                  <Badge tone="warn" className="text-xs animate-pulse bg-amber-500/15 border-amber-500/30 text-amber-300">
                    Account Cooldown (Auto-Sweep: {(autoRecoveryIntervalMs / 1000).toFixed(1)}s)
                  </Badge>
                ) : (
                  <Badge tone="warn" className="text-xs">
                    {cooldownModels.length} Model Cooldown(s)
                  </Badge>
                )}
              </div>
              <div className="text-xs text-text-tertiary space-y-0.5">
                <div className="flex items-center gap-3 flex-wrap">
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

  const autoRecoveryIntervalMs = settings?.autoRecoveryIntervalMs ?? 1000;
  const [customIntervalInput, setCustomIntervalInput] = useState<string>(
    String(autoRecoveryIntervalMs / 1000),
  );
  const [livePolling, setLivePolling] = useState<boolean>(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // Keep input in sync when backend value loads
  useEffect(() => {
    if (settings?.autoRecoveryIntervalMs) {
      setCustomIntervalInput(String(settings.autoRecoveryIntervalMs / 1000));
    }
  }, [settings?.autoRecoveryIntervalMs]);

  // Update refreshed timestamp periodically when live polling
  useEffect(() => {
    if (!livePolling) return;
    const timer = setInterval(() => {
      setLastRefreshedAt(new Date());
    }, Math.max(1000, autoRecoveryIntervalMs));
    return () => clearInterval(timer);
  }, [livePolling, autoRecoveryIntervalMs]);

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

  const handleSetIntervalMs = (ms: number) => {
    mutation.mutate(
      { autoRecoveryIntervalMs: ms },
      {
        onSuccess: () => {
          toast.success(`Auto-recovery interval updated to ${(ms / 1000).toFixed(1)}s`);
          setCustomIntervalInput(String(ms / 1000));
        },
        onError: (err) => {
          toast.error(getErrorMessage(err, "Failed to update recovery interval"));
        },
      },
    );
  };

  const handleApplyCustomInterval = () => {
    const parsedSec = parseFloat(customIntervalInput);
    if (isNaN(parsedSec) || parsedSec < 0.5 || parsedSec > 3600) {
      toast.error("Please enter a valid interval between 0.5 and 3600 seconds.");
      return;
    }
    const ms = Math.round(parsedSec * 1000);
    handleSetIntervalMs(ms);
  };

  const handleRecoverAll = (providerId?: string) => {
    recoverAllMutation.mutate(providerId ? { providerId } : undefined);
  };

  const handleRecoverSingle = (providerId: string, accountId: string) => {
    recoverSingleMutation.mutate({ providerId, accountId });
  };

  const pollingCadenceMs = livePolling ? Math.max(1000, autoRecoveryIntervalMs) : false;

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
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2 flex-wrap">
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
                  {autoRecoveryEnabled && (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                      <Clock size={12} />
                      {(autoRecoveryIntervalMs / 1000).toFixed(1)}s Cadence
                    </span>
                  )}
                </h1>
                <p className="text-sm text-text-tertiary">
                  Switch off cooldown restrictions and let CodeBuddy and your accounts execute continuously without lockouts.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Live Polling Toggle */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-secondary border border-border-subtle text-xs text-text-secondary">
              <span className="relative flex h-2.5 w-2.5">
                {livePolling && autoRecoveryEnabled && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    livePolling && autoRecoveryEnabled ? "bg-emerald-500" : "bg-text-tertiary"
                  }`}
                />
              </span>
              <span className="font-mono text-text-primary">
                {livePolling ? `Live Refresh: ${(autoRecoveryIntervalMs / 1000).toFixed(1)}s` : "Refresh Paused"}
              </span>
              <button
                type="button"
                onClick={() => setLivePolling((p) => !p)}
                title={livePolling ? "Pause live visual refresh" : "Resume live visual refresh"}
                className="p-1 hover:bg-hover rounded text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
              >
                {livePolling ? <Pause size={13} /> : <Play size={13} />}
              </button>
            </div>

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
              ? "CodeBuddy accounts run with zero cooldown backoff"
              : "Standard daily / rate limit cooldowns"}
          </p>
        </div>

        <div className={`p-4 rounded-xl border transition-all ${autoRecoveryEnabled ? "bg-cyan-500/10 border-cyan-500/30 shadow-md shadow-cyan-500/5" : "bg-surface-secondary border-border-subtle"}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
              Auto-Recovery Engine
            </span>
            <RefreshCw
              size={16}
              className={autoRecoveryEnabled ? "text-cyan-400 animate-spin" : "text-text-tertiary"}
              style={{ animationDuration: `${Math.max(2, autoRecoveryIntervalMs / 500)}s` }}
            />
          </div>
          <p className="text-lg font-bold text-text-primary mt-1">
            {autoRecoveryEnabled ? `Active (Every ${(autoRecoveryIntervalMs / 1000).toFixed(1)}s)` : "Disabled"}
          </p>
          <p className="text-xs text-text-tertiary mt-0.5">
            {autoRecoveryEnabled
              ? "Continuously cleanses stuck cooldowns in real-time"
              : "Manual recovery required"}
          </p>
        </div>
      </div>

      {/* Primary Settings Controls */}
      <Card>
        <CardHeader
          title="Bypass & Cooldown Controls"
          subtitle="Configure system-wide cooling bypass and dynamic recovery sweep timing"
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

          {/* Auto Recovery Switch */}
          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1 pr-4">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-text-primary">
                  Automatic Background Recovery Engine
                </span>
                {autoRecoveryEnabled && (
                  <Badge tone="ok" className="text-xs">
                    Running ({(autoRecoveryIntervalMs / 1000).toFixed(1)}s Cadence)
                  </Badge>
                )}
              </div>
              <p className="text-xs sm:text-sm text-text-tertiary max-w-2xl">
                Runs an automated background sweep dynamically to recover any accounts that may have recorded cooldown timestamps or previous error states, keeping them fresh and routable.
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

          {/* Dynamic Auto-Recovery Interval Config */}
          <div className="p-5 space-y-4 bg-hover/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-cyan-400" />
                  <span className="font-semibold text-sm text-text-primary">
                    Auto-Recovery Sweep Interval (Dynamic Configuration)
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    Active: {(autoRecoveryIntervalMs / 1000).toFixed(1)}s
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-text-tertiary max-w-2xl">
                  Adjust how frequently the background engine sweeps and cleanses cooling accounts. Changes apply dynamically in real-time without restarting the proxy.
                </p>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-text-secondary">Quick Interval Presets:</span>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { label: "1.0s (Aggressive / Real-Time CodeBuddy)", ms: 1000, desc: "Default for zero-delay coding" },
                  { label: "2.0s (Fast)", ms: 2000, desc: "Fast recovery" },
                  { label: "5.0s (Standard)", ms: 5000, desc: "Previous default" },
                  { label: "10.0s (Relaxed)", ms: 10000, desc: "Moderate polling" },
                  { label: "30.0s (Low Resource)", ms: 30000, desc: "Minimal queries" },
                ].map((preset) => {
                  const isSelected = autoRecoveryIntervalMs === preset.ms;
                  return (
                    <button
                      key={preset.ms}
                      type="button"
                      disabled={mutation.isPending}
                      onClick={() => handleSetIntervalMs(preset.ms)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                        isSelected
                          ? "bg-cyan-500/20 border-cyan-500/60 text-cyan-300 shadow-sm shadow-cyan-500/10 font-bold"
                          : "bg-surface-secondary border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-subtle/80 hover:bg-hover"
                      }`}
                      title={preset.desc}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Input */}
            <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-tertiary whitespace-nowrap">Custom Seconds:</span>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="3600"
                  value={customIntervalInput}
                  onChange={(e) => setCustomIntervalInput(e.target.value)}
                  disabled={mutation.isPending}
                  className="w-24 px-3 py-1.5 rounded-lg bg-surface-2 border border-border-subtle text-xs text-text-primary font-mono focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. 1"
                />
                <span className="text-xs text-text-tertiary">sec</span>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={mutation.isPending || parseFloat(customIntervalInput) * 1000 === autoRecoveryIntervalMs}
                onClick={handleApplyCustomInterval}
                className="text-xs border-cyan-500/30 hover:border-cyan-500/60 text-cyan-300 hover:bg-cyan-500/10"
              >
                Apply Custom Interval
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Operational Risk & Impact Analysis Card */}
      <div className="p-6 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-surface-secondary to-surface-primary space-y-4 shadow-lg shadow-amber-500/5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
              System Risk & Operational Impact Analysis (Analisa Resiko)
            </h3>
            <p className="text-xs text-text-tertiary">
              Trade-offs and architectural impacts of executing auto-recovery and refresh sweeps every 1 second
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="p-3.5 rounded-xl border border-border-subtle bg-surface-primary/60 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
              <Zap size={14} />
              <span>1. Database Lock & I/O Contention</span>
            </div>
            <p className="text-xs text-text-tertiary leading-relaxed">
              Polling SQLite/Postgres at 1s issues continuous <code>SELECT</code> and conditional <code>UPDATE</code> queries. In Lite (SQLite) mode, busy locks could briefly contend with intense client proxy dispatches. With Cartethyia&apos;s indexed queries, each check takes &lt;1ms, but high account volume requires adequate I/O bandwidth.
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-border-subtle bg-surface-primary/60 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-rose-300">
              <AlertTriangle size={14} />
              <span>2. Upstream Account Hard-Banning</span>
            </div>
            <p className="text-xs text-text-tertiary leading-relaxed">
              When an upstream API (such as Tencent CodeBuddy or Anthropic) responds with HTTP 429, it indicates genuine token exhaustion or concurrency rate limits. Immediately recovering accounts within 1s and redialing can trigger upstream fraud gates, risking permanent IP blacklisting or account bans.
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-border-subtle bg-surface-primary/60 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
              <RotateCcw size={14} />
              <span>3. Route Snapshot Cache Churn</span>
            </div>
            <p className="text-xs text-text-tertiary leading-relaxed">
              Every time the sweep recovers an account, it executes <code>snapshotService.invalidate()</code>. The router must re-index candidate pools. At 1s frequency during fluctuating error periods, this causes frequent route cache churn and CPU overhead in the Great Sage routing engine.
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-border-subtle bg-surface-primary/60 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
              <Sparkles size={14} />
              <span>4. Best Practice Recommendation</span>
            </div>
            <p className="text-xs text-text-tertiary leading-relaxed">
              Keep <strong>CodeBuddy Endless Mode enabled</strong> so only transient limits are bypassed. Configure multiple provider accounts in RIMURU so dispatches automatically rotate across healthy credentials rather than bombarding a single exhausted account.
            </p>
          </div>
        </div>
      </div>

      {/* Live Accounts Status & Quick Recover */}
      <Card>
        <CardHeader
          title="Account Health & Cooldown Overview"
          subtitle={`Real-time status of provider accounts (Live polling ${livePolling ? `every ${(autoRecoveryIntervalMs / 1000).toFixed(1)}s` : "paused"})`}
          icon={<Cpu size={18} className="text-accent" />}
          action={
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-text-tertiary hidden sm:inline">
                Synced: {lastRefreshedAt.toLocaleTimeString()}
              </span>
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
            </div>
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
                  refetchInterval={pollingCadenceMs}
                  codebuddyEndlessMode={codebuddyEndlessMode}
                  autoRecoveryIntervalMs={autoRecoveryIntervalMs}
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
            • <strong>Dynamic 1-Second Sweep:</strong> The background scheduler checks and cleanses transient cooldowns and pools every 1 second (dynamically adjustable), invalidating the snapshot service immediately whenever an account returns to healthy rotation.
          </p>
          <p>
            • <strong>Automatic DNS Fallback:</strong> RIMURU includes embedded DNS resolution fallback to ensure connections to <code>www.codebuddy.ai</code> and <code>copilot.tencent.com</code> never get trapped by local sinkholes or network filters.
          </p>
        </div>
      </div>
    </div>
  );
}
