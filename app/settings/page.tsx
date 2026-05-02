import { AppShell } from "@/components/app-shell";
import { GlassProfileSettingsCard } from "@/components/uitripled/profile-settings";

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account details and notification preferences.
        </p>
      </div>
      <div className="flex justify-center">
        <GlassProfileSettingsCard />
      </div>
    </AppShell>
  );
}
