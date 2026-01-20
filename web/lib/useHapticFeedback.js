import { useCallback } from 'react'

export function useHapticFeedback() {
  const triggerHaptic = useCallback((type = 'light') => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      // Map haptic types to vibration patterns
      const patterns = {
        light: 50,
        medium: 100,
        heavy: 200
      }
      navigator.vibrate(patterns[type] || 50)
    }
  }, [])

  return triggerHaptic
}