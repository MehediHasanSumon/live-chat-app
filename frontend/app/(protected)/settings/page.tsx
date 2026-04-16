"use client";

import { FormEvent, useMemo, useState } from "react";
import Image from "next/image";
import { BellRing, Camera, Save, ShieldCheck, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BoneyardSkeleton, PanelSkeleton } from "@/components/ui/boneyard-loading";
import { CheckboxInput } from "@/components/ui/checkbox-input";
import { FileInput } from "@/components/ui/file-input";
import { SelectInput } from "@/components/ui/select-input";
import { TextInput } from "@/components/ui/text-input";
import { ApiClientError } from "@/lib/api-client";
import { type AuthMeResponse, useAuthMeQuery } from "@/lib/hooks/use-auth-me-query";
import {
  useUpdateAccountPasswordMutation,
  useUpdateAccountProfileMutation,
  useUpdateNotificationSettingsMutation,
  useUpdatePresenceSettingsMutation,
  useUpdateQuietHoursMutation,
  useUpdateThemeMutation,
  useUploadUserAvatarMutation,
} from "@/lib/hooks/use-settings-mutations";

const timezoneOptions = ["Asia/Dhaka", "UTC", "Asia/Kolkata", "Asia/Karachi", "Asia/Dubai", "Europe/London", "America/New_York"];

type ProfileFormState = {
  name: string;
  username: string;
  email: string;
  phone: string;
  avatar_object_id: number | null;
  avatar_url: string | null;
  avatar_name: string | null;
};

type PasswordFormState = {
  current_password: string;
  password: string;
  password_confirmation: string;
};

function mutationErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    const firstFieldError = error.errors ? Object.values(error.errors).flat()[0] : null;
    return firstFieldError ?? error.message;
  }

  return error instanceof Error ? error.message : "Settings could not be saved.";
}

function getInitials(name: string, username: string) {
  const parts = name.split(" ").map((part) => part.trim()).filter(Boolean);
  return parts.length === 0 ? username.slice(0, 2).toUpperCase() : parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function createProfileForm(user: NonNullable<AuthMeResponse["data"]["user"]>): ProfileFormState {
  return {
    name: user.name ?? "",
    username: user.username ?? "",
    email: user.email ?? "",
    phone: user.phone ?? "",
    avatar_object_id: user.avatar_object_id ?? null,
    avatar_url: user.avatar_object?.download_url ?? null,
    avatar_name: user.avatar_object?.original_name ?? null,
  };
}

function createEmptyPasswordForm(): PasswordFormState {
  return { current_password: "", password: "", password_confirmation: "" };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-[#2d3150]">{label}</span>
      {children}
    </label>
  );
}

export default function SettingsPage() {
  const { data, isLoading } = useAuthMeQuery(true);
  const updateThemeMutation = useUpdateThemeMutation();
  const updatePresenceMutation = useUpdatePresenceSettingsMutation();
  const updateNotificationsMutation = useUpdateNotificationSettingsMutation();
  const updateQuietHoursMutation = useUpdateQuietHoursMutation();
  const updateProfileMutation = useUpdateAccountProfileMutation();
  const updatePasswordMutation = useUpdateAccountPasswordMutation();
  const uploadAvatarMutation = useUploadUserAvatarMutation();
  const user = data?.data.user;
  const settings = data?.data.settings;
  const [profileDraft, setProfileDraft] = useState<ProfileFormState | null>(null);
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>(createEmptyPasswordForm);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const isPreferenceSaving =
    updateThemeMutation.isPending ||
    updatePresenceMutation.isPending ||
    updateNotificationsMutation.isPending ||
    updateQuietHoursMutation.isPending;
  const preferenceError =
    updateThemeMutation.error ||
    updatePresenceMutation.error ||
    updateNotificationsMutation.error ||
    updateQuietHoursMutation.error;
  const isProfileBusy = updateProfileMutation.isPending || uploadAvatarMutation.isPending;
  const timezoneChoices =
    settings?.quiet_hours_timezone && !timezoneOptions.includes(settings.quiet_hours_timezone)
      ? [settings.quiet_hours_timezone, ...timezoneOptions]
      : timezoneOptions;
  const profileForm = profileDraft ?? (user ? createProfileForm(user) : null);

  const profileDirty = useMemo(() => {
    if (!user || !profileForm) {
      return false;
    }

    return (
      profileForm.name !== (user.name ?? "") ||
      profileForm.username !== (user.username ?? "") ||
      profileForm.email !== (user.email ?? "") ||
      profileForm.phone !== (user.phone ?? "") ||
      profileForm.avatar_object_id !== (user.avatar_object_id ?? null)
    );
  }, [profileForm, user]);

  async function handleAvatarUpload(file: File | null) {
    if (!file || !profileForm) {
      return;
    }

    setProfileError(null);
    setProfileNotice(null);

    try {
      const response = await uploadAvatarMutation.mutateAsync(file);
      setProfileDraft({
        ...profileForm,
        avatar_object_id: response.data?.id ?? null,
        avatar_url: response.data?.download_url ?? null,
        avatar_name: response.data?.original_name ?? null,
      });
      setProfileNotice("Avatar uploaded. Save profile to apply it.");
    } catch (error) {
      setProfileError(mutationErrorMessage(error));
    }
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profileForm) return;

    setProfileError(null);
    setProfileNotice(null);

    try {
      const response = await updateProfileMutation.mutateAsync({
        name: profileForm.name.trim(),
        username: profileForm.username.trim(),
        email: profileForm.email.trim() || null,
        phone: profileForm.phone.trim() || null,
        avatar_object_id: profileForm.avatar_object_id,
      });

      if (response.data.user) {
        setProfileDraft(createProfileForm(response.data.user));
      }

      setProfileNotice(response.data.must_verify_email ? "Profile updated. Please verify your new email." : "Profile updated successfully.");
    } catch (error) {
      setProfileError(mutationErrorMessage(error));
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordNotice(null);

    try {
      const response = await updatePasswordMutation.mutateAsync(passwordForm);
      setPasswordForm(createEmptyPasswordForm());
      setPasswordNotice(response.message);
    } catch (error) {
      setPasswordError(mutationErrorMessage(error));
    }
  }

  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto max-w-[1328px] rounded-[1.5rem] px-6 py-6 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Account Settings</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#1f2440]">Manage account, password, and avatar</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Change your username, email, password, profile picture, and personal preferences.</p>
      </section>

      {isLoading || !user || !settings || !profileForm ? (
        <section className="glass-card mx-auto mt-5 max-w-[1328px] rounded-[1.5rem]">
          <BoneyardSkeleton name="settings-loading" loading fallback={<PanelSkeleton lines={10} />}>
            <PanelSkeleton lines={10} />
          </BoneyardSkeleton>
        </section>
      ) : (
        <>
          <section className="mx-auto mt-5 grid max-w-[1328px] gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="glass-card rounded-[1.5rem] p-6">
              <div className="flex flex-col items-center text-center">
                {profileForm.avatar_url ? (
                  <Image
                    src={profileForm.avatar_url}
                    alt={profileForm.avatar_name ?? "Avatar"}
                    width={112}
                    height={112}
                    unoptimized
                    className="h-28 w-28 rounded-[2rem] object-cover"
                  />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-[2rem] bg-[linear-gradient(135deg,#111827,#334155)] text-3xl font-semibold text-white">
                    {getInitials(profileForm.name || profileForm.username, profileForm.username || "GU")}
                  </div>
                )}
                <p className="mt-5 text-xl font-semibold text-[#202743]">{profileForm.name || profileForm.username}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">@{profileForm.username}</p>

                <div className="mt-6 w-full rounded-[1.1rem] border border-[var(--line)] bg-white/75 p-4 text-left">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#27304d]">
                    <Camera className="h-4 w-4 text-[var(--accent)]" />
                    Avatar
                  </div>
                  <FileInput className="mt-4" accept="image/*" disabled={isProfileBusy} onChange={(event) => void handleAvatarUpload(event.target.files?.[0] ?? null)} />
                  {profileForm.avatar_name ? <p className="mt-2 text-xs text-[var(--muted)]">{profileForm.avatar_name}</p> : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-3"
                    disabled={isProfileBusy || profileForm.avatar_object_id === null}
                    onClick={() => setProfileDraft({ ...profileForm, avatar_object_id: null, avatar_url: null, avatar_name: null })}
                  >
                    Remove avatar
                  </Button>
                </div>
              </div>
            </aside>

            <div className="space-y-5">
              <section className="glass-card rounded-[1.5rem] p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[#1f2440]">Profile details</h2>
                    <p className="text-sm text-[var(--muted)]">Username, email, and personal info.</p>
                  </div>
                </div>

                <form className="mt-6 space-y-5" onSubmit={handleProfileSubmit} noValidate>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Full name">
                      <TextInput value={profileForm.name} disabled={isProfileBusy} onChange={(event) => setProfileDraft({ ...profileForm, name: event.target.value })} />
                    </Field>
                    <Field label="Username">
                      <TextInput value={profileForm.username} disabled={isProfileBusy} onChange={(event) => setProfileDraft({ ...profileForm, username: event.target.value })} />
                    </Field>
                    <Field label="Email">
                      <TextInput type="email" value={profileForm.email} disabled={isProfileBusy} onChange={(event) => setProfileDraft({ ...profileForm, email: event.target.value })} />
                    </Field>
                    <Field label="Phone">
                      <TextInput value={profileForm.phone} disabled={isProfileBusy} onChange={(event) => setProfileDraft({ ...profileForm, phone: event.target.value })} />
                    </Field>
                  </div>

                  {profileError ? <p className="text-sm text-rose-600">{profileError}</p> : null}
                  {profileNotice ? <p className="text-sm text-emerald-700">{profileNotice}</p> : null}

                  <Button type="submit" className="gap-2 rounded-full px-5" disabled={isProfileBusy || !profileDirty}>
                    <Save className="h-4 w-4" />
                    {isProfileBusy ? "Saving..." : "Save profile"}
                  </Button>
                </form>
              </section>

              <section className="glass-card rounded-[1.5rem] p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[#1f2440]">Password</h2>
                    <p className="text-sm text-[var(--muted)]">Confirm the current password before changing it.</p>
                  </div>
                </div>

                <form className="mt-6 space-y-4" onSubmit={handlePasswordSubmit} noValidate>
                  <Field label="Current password">
                    <TextInput type="password" value={passwordForm.current_password} disabled={updatePasswordMutation.isPending} onChange={(event) => setPasswordForm((current) => ({ ...current, current_password: event.target.value }))} />
                  </Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="New password">
                      <TextInput type="password" value={passwordForm.password} disabled={updatePasswordMutation.isPending} onChange={(event) => setPasswordForm((current) => ({ ...current, password: event.target.value }))} />
                    </Field>
                    <Field label="Confirm password">
                      <TextInput type="password" value={passwordForm.password_confirmation} disabled={updatePasswordMutation.isPending} onChange={(event) => setPasswordForm((current) => ({ ...current, password_confirmation: event.target.value }))} />
                    </Field>
                  </div>

                  {passwordError ? <p className="text-sm text-rose-600">{passwordError}</p> : null}
                  {passwordNotice ? <p className="text-sm text-emerald-700">{passwordNotice}</p> : null}

                  <Button type="submit" className="rounded-full px-5" disabled={updatePasswordMutation.isPending || !passwordForm.current_password || !passwordForm.password || !passwordForm.password_confirmation}>
                    {updatePasswordMutation.isPending ? "Updating..." : "Update password"}
                  </Button>
                </form>
              </section>
            </div>
          </section>

          <section className="glass-card mx-auto mt-5 max-w-[1328px] rounded-[1.5rem] p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <BellRing className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#1f2440]">Preferences</h2>
                <p className="text-sm text-[var(--muted)]">Theme, presence, notifications, and quiet hours.</p>
              </div>
            </div>

            {preferenceError ? <p className="mt-4 text-sm text-rose-600">{mutationErrorMessage(preferenceError)}</p> : null}

            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <section className="rounded-[1.2rem] border border-[var(--line)] bg-white/75 p-5">
                <p className="text-sm font-semibold text-[#2d3150]">Theme</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(["system", "light", "dark"] as const).map((theme) => (
                    <Button key={theme} variant={settings.theme === theme ? "primary" : "ghost"} disabled={isPreferenceSaving} onClick={() => updateThemeMutation.mutate(theme)}>
                      {theme}
                    </Button>
                  ))}
                </div>
              </section>

              <section className="rounded-[1.2rem] border border-[var(--line)] bg-white/75 p-5">
                <p className="text-sm font-semibold text-[#2d3150]">Presence</p>
                <div className="mt-4 space-y-3">
                  <label className="flex items-center gap-3 text-sm"><CheckboxInput checked={settings.show_active_status} disabled={isPreferenceSaving} onChange={(event) => updatePresenceMutation.mutate({ show_active_status: event.target.checked, allow_message_requests: settings.allow_message_requests })} />Show active status</label>
                  <label className="flex items-center gap-3 text-sm"><CheckboxInput checked={settings.allow_message_requests} disabled={isPreferenceSaving} onChange={(event) => updatePresenceMutation.mutate({ show_active_status: settings.show_active_status, allow_message_requests: event.target.checked })} />Allow message requests</label>
                </div>
              </section>

              <section className="rounded-[1.2rem] border border-[var(--line)] bg-white/75 p-5">
                <p className="text-sm font-semibold text-[#2d3150]">Notifications</p>
                <div className="mt-4 space-y-3">
                  <label className="flex items-center gap-3 text-sm"><CheckboxInput checked={settings.push_enabled} disabled={isPreferenceSaving} onChange={(event) => updateNotificationsMutation.mutate({ push_enabled: event.target.checked, sound_enabled: settings.sound_enabled, vibrate_enabled: settings.vibrate_enabled })} />Push enabled</label>
                  <label className="flex items-center gap-3 text-sm"><CheckboxInput checked={settings.sound_enabled} disabled={isPreferenceSaving} onChange={(event) => updateNotificationsMutation.mutate({ push_enabled: settings.push_enabled, sound_enabled: event.target.checked, vibrate_enabled: settings.vibrate_enabled })} />Sound enabled</label>
                  <label className="flex items-center gap-3 text-sm"><CheckboxInput checked={settings.vibrate_enabled} disabled={isPreferenceSaving} onChange={(event) => updateNotificationsMutation.mutate({ push_enabled: settings.push_enabled, sound_enabled: settings.sound_enabled, vibrate_enabled: event.target.checked })} />Vibrate enabled</label>
                </div>
              </section>

              <section className="rounded-[1.2rem] border border-[var(--line)] bg-white/75 p-5">
                <p className="text-sm font-semibold text-[#2d3150]">Quiet hours</p>
                <div className="mt-4 space-y-3">
                  <label className="flex items-center gap-3 text-sm"><CheckboxInput checked={settings.quiet_hours_enabled} disabled={isPreferenceSaving} onChange={(event) => updateQuietHoursMutation.mutate({ quiet_hours_enabled: event.target.checked, quiet_hours_start: settings.quiet_hours_start, quiet_hours_end: settings.quiet_hours_end, quiet_hours_timezone: settings.quiet_hours_timezone })} />Quiet hours enabled</label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Start"><TextInput type="time" value={settings.quiet_hours_start ?? ""} disabled={isPreferenceSaving} onChange={(event) => updateQuietHoursMutation.mutate({ quiet_hours_enabled: settings.quiet_hours_enabled, quiet_hours_start: event.target.value || null, quiet_hours_end: settings.quiet_hours_end, quiet_hours_timezone: settings.quiet_hours_timezone })} /></Field>
                    <Field label="End"><TextInput type="time" value={settings.quiet_hours_end ?? ""} disabled={isPreferenceSaving} onChange={(event) => updateQuietHoursMutation.mutate({ quiet_hours_enabled: settings.quiet_hours_enabled, quiet_hours_start: settings.quiet_hours_start, quiet_hours_end: event.target.value || null, quiet_hours_timezone: settings.quiet_hours_timezone })} /></Field>
                  </div>
                  <Field label="Timezone">
                    <SelectInput
                      value={settings.quiet_hours_timezone}
                      disabled={isPreferenceSaving}
                      dropdownLabel="Timezone"
                      options={timezoneChoices.map((timezone) => ({ value: timezone, label: timezone }))}
                      onChange={(nextValue) => updateQuietHoursMutation.mutate({ quiet_hours_enabled: settings.quiet_hours_enabled, quiet_hours_start: settings.quiet_hours_start, quiet_hours_end: settings.quiet_hours_end, quiet_hours_timezone: nextValue })}
                    />
                  </Field>
                </div>
              </section>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
