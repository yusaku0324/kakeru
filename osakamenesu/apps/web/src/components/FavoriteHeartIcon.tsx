type FavoriteHeartIconProps = {
  filled: boolean
  className?: string
}

export function FavoriteHeartIcon({ filled, className }: FavoriteHeartIconProps) {
  const classes = ['h-5 w-5', className].filter(Boolean).join(' ')
  return (
    <svg
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
      fill={filled ? '#ef4444' : 'none'}
      className={classes}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.318 6.318a4.5 4.5 0 0 1 6.364 0L12 7.636l1.318-1.318a4.5 4.5 0 1 1 6.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 0 1 0-6.364z"
      />
    </svg>
  )
}
