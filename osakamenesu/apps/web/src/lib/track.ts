export type TrackPayload = Record<string, unknown> | undefined

type TrackFn = (event: string, payload?: TrackPayload) => void

const tracker: TrackFn = (event, payload) => {
  // TODO: replace with production analytics client
  const detail = payload ?? {}
  console.log('[track]', event, detail)
}

export const track: TrackFn = (event, payload) => {
  try {
    tracker(event, payload)
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[track:error]', error)
    }
  }
}

export default track
