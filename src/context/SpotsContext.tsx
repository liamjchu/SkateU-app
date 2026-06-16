import AsyncStorage from '@react-native-async-storage/async-storage'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Spot } from '../types/spot'

const SPOTS_STORAGE_KEY = '@skateu:spots'

type SpotsContextValue = {
  spots: Spot[]
  addSpot: (spot: Spot) => Promise<void>
  removeSpot: (spotId: string) => Promise<void>
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
            const isValid = (item: unknown): item is Spot => {
              if (typeof item !== 'object' || item === null) {
                return false
              }

              const record = item as Record<string, unknown>

              return (
                typeof record.id === 'string' &&
                typeof record.name === 'string' &&
                typeof record.description === 'string' &&
                typeof record.latitude === 'number' &&
                typeof record.longitude === 'number' &&
                Array.isArray(record.imageUris) &&
                record.imageUris.every((uri: unknown) => typeof uri === 'string') &&
                typeof record.city === 'string' &&
                typeof record.state === 'string' &&
                (record.schoolId === undefined || typeof record.schoolId === 'string')
              )
            }

            const validSpots = parsed.filter(isValid)

            if (validSpots.length === parsed.length) {
              setSpots(validSpots)
            } else if (validSpots.length > 0) {
              const skipped = parsed
                .map((item: unknown, index: number) => ({ item, index }))
                .filter(({ item }) => !isValid(item))
                .map(({ index, item }) => {
                  let id: string | undefined

                  if (typeof item === 'object' && item !== null) {
                    const record = item as Record<string, unknown>

                    if (typeof record.id === 'string') {
                      id = record.id
                    }
                  }

                  return { index, id }
                })

              console.warn(
                `Stored spots contained invalid entries; persisted ${validSpots.length}/${parsed.length}. Skipped entries:`,
                skipped
              )

              setSpots(validSpots)
            } else {
              console.warn('Stored spots data is invalid and will be ignored')
              setSpots(validSpots)
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
      throw error
    }
  }, [])

  const pendingPersistPromise = useRef<Promise<void>>(Promise.resolve())

  const addSpot = useCallback(
    async (spot: Spot) => {
      let nextSpots: Spot[] = []

      setSpots((currentSpots) => {
        nextSpots = [...currentSpots, spot]
        return nextSpots
      })

      const persistOperation = async () => {
        try {
          await persistSpots(nextSpots)
        } catch (error) {
          console.warn('Failed to persist spots after addSpot', error)
          setSpots((current) => current.filter((s) => s.id !== spot.id))
          throw error
        }
      }

      const nextPromise = pendingPersistPromise.current.then(
        () => persistOperation(),
        () => persistOperation()
      )

      pendingPersistPromise.current = nextPromise.catch(() => {})

      return nextPromise
    },
    [persistSpots]
  )

  const removeSpot = useCallback(
    async (spotId: string) => {
      let nextSpots: Spot[] = []
      let removedSpot: Spot | undefined
      let removedIndex = -1

      setSpots((currentSpots) => {
        removedIndex = currentSpots.findIndex((spot) => spot.id === spotId)
        removedSpot = removedIndex >= 0 ? currentSpots[removedIndex] : undefined
        nextSpots = currentSpots.filter((spot) => spot.id !== spotId)
        return nextSpots
      })

      const persistOperation = async () => {
        try {
          await persistSpots(nextSpots)
        } catch (error) {
          console.warn('Failed to persist spots after removeSpot', error)
            if (removedSpot && removedIndex >= 0) {
              setSpots((current) => {
              if (current.some((spot) => spot.id === removedSpot!.id)) return current
                const restored = [...current]
                restored.splice(Math.min(removedIndex, restored.length), 0, removedSpot!)
                return restored
              })
            }
          throw error
        }
      }

      const nextPromise = pendingPersistPromise.current.then(
        () => persistOperation(),
        () => persistOperation()
      )

      pendingPersistPromise.current = nextPromise.catch(() => {})

      return nextPromise
    },
    [persistSpots]
  )

  const value = useMemo(() => ({ spots, addSpot, removeSpot }), [spots, addSpot, removeSpot])

  return <SpotsContext.Provider value={value}>{children}</SpotsContext.Provider>
}

export function useSpots() {
  const context = useContext(SpotsContext)

  if (!context) {
    throw new Error('useSpots must be used within a SpotsProvider')
  }

  return context
}
