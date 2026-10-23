import { BackupControls, ProviderManagerContent } from '../components/ProviderManager'
import { cardClass } from '../lib/ui'
import type { ProviderId } from '../lib/providers'

interface SettingsViewProps {
  keys: Partial<Record<ProviderId, string>>
  activeProvider: ProviderId
  onKeysChange: (keys: Partial<Record<ProviderId, string>>) => void
  onActiveChange: (id: ProviderId) => void
}

export default function SettingsView({
  keys,
  activeProvider,
  onKeysChange,
  onActiveChange,
}: SettingsViewProps) {
  return (
    <>
      <section className="max-w-3xl pt-10 pb-6">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-2 text-[14px] text-[#6f6858]">
          Keys, providers, and your data.
        </p>
      </section>

      <section className="flex max-w-3xl flex-col gap-6 pb-16">
        <div className={`${cardClass} p-5`}>
          <ProviderManagerContent
            keys={keys}
            activeProvider={activeProvider}
            onKeysChange={onKeysChange}
            onActiveChange={onActiveChange}
          />

          <div className="my-4 border-t border-[#e2dccb]" />

          <BackupControls />
        </div>

        <p className="text-[12.5px] text-[#8a8371]">
          Your resume and keys stay in this browser. Never uploaded anywhere
          else.
        </p>
      </section>
    </>
  )
}
