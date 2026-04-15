"use client";

import { Button } from "@/components/ui/button";
import { CheckboxInput } from "@/components/ui/checkbox-input";
import { TextInput } from "@/components/ui/text-input";
import { ApiClientError } from "@/lib/api-client";
import { useAuthMeQuery } from "@/lib/hooks/use-auth-me-query";
import {
  useUpdateNotificationSettingsMutation,
  useUpdatePresenceSettingsMutation,
  useUpdateQuietHoursMutation,
  useUpdateThemeMutation,
} from "@/lib/hooks/use-settings-mutations";

const themeLabels = {
  system: "System",
  light: "Light",
  dark: "Dark",
} as const;

const timezoneOptions = ["Asia/Dhaka", "UTC", "Asia/Kolkata", "Asia/Karachi", "Asia/Dubai", "Europe/London", "America/New_York"];

function mutationErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    const firstFieldError = error.errors ? Object.values(error.errors).flat()[0] : null;
    return firstFieldError ?? error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Settings could not be saved.";
}

export default function SettingsPage() {
  const { data, isLoading } = useAuthMeQuery(true);
  const updateThemeMutation = useUpdateThemeMutation();
  const updatePresenceMutation = useUpdatePresenceSettingsMutation();
  const updateNotificationsMutation = useUpdateNotificationSettingsMutation();
  const updateQuietHoursMutation = useUpdateQuietHoursMutation();
  const settings = data?.data.settings;
  const isSaving =
    updateThemeMutation.isPending ||
    updatePresenceMutation.isPending ||
    updateNotificationsMutation.isPending ||
    updateQuietHoursMutation.isPending;
  const saveError =
    updateThemeMutation.error ||
    updatePresenceMutation.error ||
    updateNotificationsMutation.error ||
    updateQuietHoursMutation.error;
  const timezoneChoices =
    settings?.quiet_hours_timezone && !timezoneOptions.includes(settings.quiet_hours_timezone)
      ? [settings.quiet_hours_timezone, ...timezoneOptions]
      : timezoneOptions;

  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto w-full max-w-5xl rounded-[1.5rem] px-5 py-5 sm:px-6">
        <div>
          <p className="text-lg font-semibold text-[#2d3150]">Settings</p>
          <p className="text-sm text-[var(--muted)]">Control theme, presence, quiet hours, and notification behavior.</p>
          {isSaving ? <p className="mt-2 text-xs font-medium text-[var(--accent)]">Saving changes...</p> : null}
          {saveError ? <p className="mt-2 text-xs font-medium text-rose-600">{mutationErrorMessage(saveError)}</p> : null}
        </div>

        {isLoading || !settings ? (
          <div className="mt-6 rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-4 text-sm text-[var(--muted)]">
            Loading settings...
          </div>
        ) : (
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <section className="rounded-[1.25rem] border border-[var(--line)] bg-white/75 p-5">
              <h2 className="text-base font-semibold text-[#2d3150]">Theme</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {(["system", "light", "dark"] as const).map((theme) => (
                  <Button
                    key={theme}
                    variant={settings.theme === theme ? "primary" : "ghost"}
                    disabled={isSaving}
                    onClick={() => {
                      updateThemeMutation.mutate(theme);
                    }}
                  >
                    {themeLabels[theme]}
                  </Button>
                ))}
              </div>
            </section>

            <section className="rounded-[1.25rem] border border-[var(--line)] bg-white/75 p-5">
              <h2 className="text-base font-semibold text-[#2d3150]">Presence & requests</h2>
              <div className="mt-4 space-y-3">
                <label className="flex items-center gap-3 text-sm text-[var(--foreground)]">
                  <CheckboxInput
                    checked={settings.show_active_status}
                    disabled={isSaving}
                    onChange={(event) => {
                      updatePresenceMutation.mutate({
                        show_active_status: event.target.checked,
                        allow_message_requests: settings.allow_message_requests,
                      });
                    }}
                  />
                  Show active status
                </label>
                <label className="flex items-center gap-3 text-sm text-[var(--foreground)]">
                  <CheckboxInput
                    checked={settings.allow_message_requests}
                    disabled={isSaving}
                    onChange={(event) => {
                      updatePresenceMutation.mutate({
                        show_active_status: settings.show_active_status,
                        allow_message_requests: event.target.checked,
                      });
                    }}
                  />
                  Allow message requests
                </label>
              </div>
            </section>

            <section className="rounded-[1.25rem] border border-[var(--line)] bg-white/75 p-5">
              <h2 className="text-base font-semibold text-[#2d3150]">Notifications</h2>
              <div className="mt-4 space-y-3">
                <label className="flex items-center gap-3 text-sm text-[var(--foreground)]">
                  <CheckboxInput
                    checked={settings.push_enabled}
                    disabled={isSaving}
                    onChange={(event) => {
                      updateNotificationsMutation.mutate({
                        push_enabled: event.target.checked,
                        sound_enabled: settings.sound_enabled,
                        vibrate_enabled: settings.vibrate_enabled,
                      });
                    }}
                  />
                  Push enabled
                </label>
                <label className="flex items-center gap-3 text-sm text-[var(--foreground)]">
                  <CheckboxInput
                    checked={settings.sound_enabled}
                    disabled={isSaving}
                    onChange={(event) => {
                      updateNotificationsMutation.mutate({
                        push_enabled: settings.push_enabled,
                        sound_enabled: event.target.checked,
                        vibrate_enabled: settings.vibrate_enabled,
                      });
                    }}
                  />
                  Sound enabled
                </label>
                <label className="flex items-center gap-3 text-sm text-[var(--foreground)]">
                  <CheckboxInput
                    checked={settings.vibrate_enabled}
                    disabled={isSaving}
                    onChange={(event) => {
                      updateNotificationsMutation.mutate({
                        push_enabled: settings.push_enabled,
                        sound_enabled: settings.sound_enabled,
                        vibrate_enabled: event.target.checked,
                      });
                    }}
                  />
                  Vibrate enabled
                </label>
              </div>
            </section>

            <section className="rounded-[1.25rem] border border-[var(--line)] bg-white/75 p-5">
              <h2 className="text-base font-semibold text-[#2d3150]">Quiet hours</h2>
              <div className="mt-4 space-y-3">
                <label className="flex items-center gap-3 text-sm text-[var(--foreground)]">
                  <CheckboxInput
                    checked={settings.quiet_hours_enabled}
                    disabled={isSaving}
                    onChange={(event) => {
                      updateQuietHoursMutation.mutate({
                        quiet_hours_enabled: event.target.checked,
                        quiet_hours_start: settings.quiet_hours_start,
                        quiet_hours_end: settings.quiet_hours_end,
                        quiet_hours_timezone: settings.quiet_hours_timezone,
                      });
                    }}
                  />
                  Quiet hours enabled
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm text-[var(--foreground)]">
                    <span className="mb-1 block text-xs font-medium text-[var(--muted)]">Start time</span>
                    <TextInput
                      type="time"
                      value={settings.quiet_hours_start ?? ""}
                      disabled={isSaving}
                      onChange={(event) => {
                        updateQuietHoursMutation.mutate({
                          quiet_hours_enabled: settings.quiet_hours_enabled,
                          quiet_hours_start: event.target.value || null,
                          quiet_hours_end: settings.quiet_hours_end,
                          quiet_hours_timezone: settings.quiet_hours_timezone,
                        });
                      }}
                    />
                  </label>
                  <label className="block text-sm text-[var(--foreground)]">
                    <span className="mb-1 block text-xs font-medium text-[var(--muted)]">End time</span>
                    <TextInput
                      type="time"
                      value={settings.quiet_hours_end ?? ""}
                      disabled={isSaving}
                      onChange={(event) => {
                        updateQuietHoursMutation.mutate({
                          quiet_hours_enabled: settings.quiet_hours_enabled,
                          quiet_hours_start: settings.quiet_hours_start,
                          quiet_hours_end: event.target.value || null,
                          quiet_hours_timezone: settings.quiet_hours_timezone,
                        });
                      }}
                    />
                  </label>
                </div>

                <label className="block text-sm text-[var(--foreground)]">
                  <span className="mb-1 block text-xs font-medium text-[var(--muted)]">Timezone</span>
                  <select
                    value={settings.quiet_hours_timezone}
                    disabled={isSaving}
                    className="pill-input h-9 w-full px-3 text-sm outline-none transition focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                    onChange={(event) => {
                      updateQuietHoursMutation.mutate({
                        quiet_hours_enabled: settings.quiet_hours_enabled,
                        quiet_hours_start: settings.quiet_hours_start,
                        quiet_hours_end: settings.quiet_hours_end,
                        quiet_hours_timezone: event.target.value,
                      });
                    }}
                  >
                    {timezoneChoices.map((timezone) => (
                      <option key={timezone} value={timezone}>
                        {timezone}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
