import AsyncStorage from '@react-native-async-storage/async-storage'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Spot } from '../types/spot'

const SPOTS_STORAGE_KEY = '@skateu:spots'

type SpotsContextValue = {
  spots: Spot[]
  addSpot: (spot: Spot) => Promise<void>
}

const SpotsContext = createContext<SpotsContextValue | undefined>(undefined)

export function SpotsProvider({ children }: { children: React.ReactNode }) {
  const [spots, setSpots] = useState<Spot[]>([])

  useEffect(() => {
    async function loadSpots() {
      try {
        const storedSpots = await AsyncStorage.getItem(SPOTS_STORAGE_KEY)

        if (storedSpots) {
          const parsed = JSON.parse(storedSpots)

          if (Array.isArray(parsed)) {
            const validSpots = parsed.filter((item): item is Spot => {
              return (
                item &&
                typeof item === 'object' &&
                typeof (item as any).id === 'string' &&
                typeof (item as any).name === 'string' &&
                typeof (item as any).description === 'string' &&
                typeof (item as any).latitude === 'number' &&
                typeof (item as any).longitude === 'number' &&
                Array.isArray((item as any).imageUris) &&
                (item as any).imageUris.every((uri: unknown) => typeof uri === 'string')
              )
            })

            if (validSpots.length === parsed.length) {
              setSpots(validSpots)
            } else {
              console.warn('Stored spots data is invalid and will be ignored')
            }
          } else {
            console.warn('Stored spots data is not an array and will be ignored')
          }
        }
      } catch (error) {
        console.warn('Failed to load spots from storage', error)
      }
    }

    loadSpots()
  }, [])

  const persistSpots = useCallback(async (nextSpots: Spot[]) => {
    try {
      await AsyncStorage.setItem(SPOTS_STORAGE_KEY, JSON.stringify(nextSpots))
    } catch (error) {
      console.warn('Failed to persist spots to storage', error)
    }
  }, [])

  const addSpot = useCallback(
    async (spot: Spot) => {
      let nextSpots: Spot[] = []

      setSpots((currentSpots) => {
        nextSpots = [...currentSpots, spot]
        return nextSpots
      })

      try {
        await persistSpots(nextSpots)
      } catch (error) {
        console.warn('Failed to persist spots after addSpot', error)
        // rollback optimistic update
        setSpots((current) => current.filter((s) => s.id !== spot.id))
        throw error
      }
    },
    [persistSpots]
  )

  const value = useMemo(() => ({ spots, addSpot }), [spots, addSpot])

  return <SpotsContext.Provider value={value}>{children}</SpotsContext.Provider>
}

export function useSpots() {
  const context = useContext(SpotsContext)

  if (!context) {
    throw new Error('useSpots must be used within a SpotsProvider')
  }

  return context
}
