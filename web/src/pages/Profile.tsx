/** The profile screen: the form and the CV, side by side on a wide window. */

import type { ProfileData } from '@shared/api'
import { Header, Loading, Problems, ScreenError } from '@/components/ui'
import { useT } from '@/i18n'
import { useData } from '@/lib/api'
import { CvEditor, ProfileForm, ProfilePanel } from '@/profile/ProfileForm'

export default function Profile() {
  const t = useT()
  const data = useData<ProfileData>('/api/profile')
  if (data.error) return <ScreenError error={data.error} onRetry={data.reload} />
  if (!data.data) return <Loading />
  return (
    <div className="flex flex-col gap-6">
      <Header title={t.profile.title} note={t.profile.note} />
      <Problems problems={data.data.problems} file="profile/profile.json" />
      <div className="grid gap-4 xl:grid-cols-2">
        <ProfilePanel title={t.profile.title}>
          <ProfileForm profile={data.data.profile} onSaved={data.reload} />
        </ProfilePanel>
        <ProfilePanel title={t.profile.cv}>
          <p className="mb-4 text-sm text-muted">{t.profile.cvNote}</p>
          <CvEditor cv={data.data.cv} onSaved={data.reload} />
        </ProfilePanel>
      </div>
    </div>
  )
}
