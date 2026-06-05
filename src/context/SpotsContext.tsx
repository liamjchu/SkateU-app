import AsyncStorage from '@react-native-async-storage/async-storage'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Spot } from '../types/spot'

const SPOTS_STORAGE_KEY = '@skateu:spots'

type SpotsContextValue = {
  spots: Spot[]
  addSpot: (spot: Spot) => void
}

const SpotsContext = createContext<SpotsContextValue | undefined>(undefined)

export function SpotsProvider({ children }: { children: React.ReactNode }) {
  const [spots, setSpots] = useState<Spot[]>([])

  useEffect(() => {
    async function loadSpots() {
      try {
        const storedSpots = await AsyncStorage.getItem(SPOTS_STORAGE_KEY)

        if (storedSpots) {
          const parsedSpots = JSON.parse(storedSpots) as Spot[]
          setSpots(parsedSpots)
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
    (spot: Spot) => {
      setSpots((currentSpots) => {
        const nextSpots = [...currentSpots, spot]
        persistSpots(nextSpots)
        return nextSpots
      })
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
