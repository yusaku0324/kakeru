'use client'

import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton'
import { LineLoginButton } from '@/components/auth/LineLoginButton'

type SocialLoginButtonsProps = {
  redirectPath?: string
}

export function SocialLoginButtons({ redirectPath = '/therapist/settings' }: SocialLoginButtonsProps) {
  return (
    <div className="space-y-3">
      <GoogleLoginButton redirectPath={redirectPath} className="w-full" />
      <LineLoginButton redirectPath={redirectPath} className="w-full" />
    </div>
  )
}
