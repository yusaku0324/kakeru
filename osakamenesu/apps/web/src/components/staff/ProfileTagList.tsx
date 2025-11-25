import clsx from 'clsx'

import { Chip } from '@/components/ui/Chip'
import {
  buildProfileTagDisplays,
  type ProfileTagValues,
} from '@/features/therapist/profileTags'

type ProfileTagListProps = ProfileTagValues & {
  className?: string
  includeTalkLevel?: boolean
}

export function ProfileTagList({
  mood_tag,
  style_tag,
  look_type,
  contact_style,
  hobby_tags,
  talk_level,
  className,
  includeTalkLevel = false,
}: ProfileTagListProps) {
  const tags = buildProfileTagDisplays(
    { mood_tag, style_tag, look_type, contact_style, hobby_tags, talk_level },
    { includeTalkLevel },
  )

  if (!tags.length) return null

  return (
    <div className={clsx('flex flex-wrap gap-2', className)}>
      {tags.map((tag) => (
        <Chip key={tag.key} variant="subtle" className="text-[11px]">
          {tag.label}
        </Chip>
      ))}
    </div>
  )
}

export default ProfileTagList
