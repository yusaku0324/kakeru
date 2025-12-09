import { ShiftList } from './ShiftList'

type Props = {
  params: Promise<{ profileId: string }>
}

export default async function ShiftsPage({ params }: Props) {
  const { profileId } = await params

  return (
    <div className="min-h-screen bg-neutral-background p-6">
      <div className="mx-auto max-w-5xl">
        <ShiftList profileId={profileId} />
      </div>
    </div>
  )
}
