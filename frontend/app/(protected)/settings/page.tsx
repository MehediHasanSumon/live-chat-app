"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { CheckboxInput } from "@/components/ui/checkbox-input";
import { TextInput } from "@/components/ui/text-input";
import { useAuthMeQuery } from "@/lib/hooks/use-auth-me-query";
import {
  useUpdateNotificationSettingsMutation,
  useUpdatePresenceSettingsMutation,
  useUpdateQuietHoursMutation,
  useUpdateThemeMutation,
} from "@/lib/hooks/use-settings-mutations";

export default function SettingsPage() {
  const { data, isLoading } = useAuthMeQuery(true);
  const updateThemeMutation = useUpdateThemeMutation();
  const updatePresenceMutation = useUpdatePresenceSettingsMutation();
  const updateNotificationsMutation = useUpdateNotificationSettingsMutation();
  const updateQuietHoursMutation = useUpdateQuietHoursMutation();
  const settings = data?.data.settings;

  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto w-full max-w-5xl rounded-[1.5rem] px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-lg font-semibold text-[#2d3150]">Settings</p>
              <p className="text-sm text-[var(--muted)]">Control theme, privacy, quiet hours, and notification behavior.</p>
            </div>
            <Link
              href="/messages"
              className="rounded-full border border-[var(--line)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--foreground)]"
            >
              Back to messages
            </Link>
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
                      disabled={updateThemeMutation.isPending}
                      onClick={() => {
                        void updateThemeMutation.mutateAsync(theme);
                      }}
                    >
                      {theme}
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
                      onChange={(event) => {
                        void updatePresenceMutation.mutateAsync({
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
                      onChange={(event) => {
                        void updatePresenceMutation.mutateAsync({
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
                      onChange={(event) => {
                        void updateNotificationsMutation.mutateAsync({
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
                      onChange={(event) => {
                        void updateNotificationsMutation.mutateAsync({
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
                      onChange={(event) => {
                        void updateNotificationsMutation.mutateAsync({
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
                      onChange={(event) => {
                        void updateQuietHoursMutation.mutateAsync({
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
                    <TextInput
                      type="time"
                      value={settings.quiet_hours_start ?? ""}
                      onChange={(event) => {
                        void updateQuietHoursMutation.mutateAsync({
                          quiet_hours_enabled: settings.quiet_hours_enabled,
                          quiet_hours_start: event.target.value || null,
                          quiet_hours_end: settings.quiet_hours_end,
                          quiet_hours_timezone: settings.quiet_hours_timezone,
                        });
                      }}
                    />
                    <TextInput
                      type="time"
                      value={settings.quiet_hours_end ?? ""}
                      onChange={(event) => {
                        void updateQuietHoursMutation.mutateAsync({
                          quiet_hours_enabled: settings.quiet_hours_enabled,
                          quiet_hours_start: settings.quiet_hours_start,
                          quiet_hours_end: event.target.value || null,
                          quiet_hours_timezone: settings.quiet_hours_timezone,
                        });
                      }}
                    />
                  </div>
                  <TextInput
                    value={settings.quiet_hours_timezone}
                    onChange={(event) => {
                      void updateQuietHoursMutation.mutateAsync({
                        quiet_hours_enabled: settings.quiet_hours_enabled,
                        quiet_hours_start: settings.quiet_hours_start,
                        quiet_hours_end: settings.quiet_hours_end,
                        quiet_hours_timezone: event.target.value,
                      });
                    }}
                  />
                </div>
              </section>
            </div>
          )}
      </section>
    </main>
  );
}
