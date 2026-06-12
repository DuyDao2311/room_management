import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { getFavorites, addFavorite as addFavoriteApi, removeFavorite as removeFavoriteApi } from '../api/favorites'
import { useAuth } from './AuthContext'

export interface FavoriteRoom {
  _id: string
  name: string
  address: string
  price: number
  area?: number
  type?: string
  status: 'available' | 'occupied' | 'maintenance'
  images: any[]
}

interface FavoritesContextType {
  favorites: FavoriteRoom[]
  toggleFavorite: (room: FavoriteRoom) => Promise<void>
  isFavorite: (roomId: string) => boolean
  removeFavorite: (roomId: string) => Promise<void>
  clearFavorites: () => void
  loading: boolean
}

const FavoritesContext = createContext<FavoritesContextType | null>(null)

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [favorites, setFavorites] = useState<FavoriteRoom[]>([])
  const [loading, setLoading] = useState(false)

  // Load favorites từ DB khi user đăng nhập, xóa khi đăng xuất
  useEffect(() => {
    if (!user || user.role !== 'tenant') {
      setFavorites([])
      setLoading(false)
      return
    }

    const loadFavorites = async () => {
      setLoading(true)
      try {
        const data = await getFavorites()
        setFavorites(data)
      } catch (error) {
        console.error('Failed to load favorites:', error)
        setFavorites([])
      } finally {
        setLoading(false)
      }
    }

    loadFavorites()
  }, [user?._id]) // Reload khi user thay đổi

  const isFavorite = (roomId: string) => favorites.some(r => r._id === roomId)

  const toggleFavorite = async (room: FavoriteRoom) => {
    if (isFavorite(room._id)) {
      // Optimistic update
      setFavorites(prev => prev.filter(r => r._id !== room._id))
      try {
        await removeFavoriteApi(room._id)
      } catch {
        // Rollback nếu API thất bại
        setFavorites(prev => [room, ...prev])
      }
    } else {
      // Optimistic update
      setFavorites(prev => [room, ...prev])
      try {
        await addFavoriteApi(room._id)
      } catch {
        // Rollback nếu API thất bại
        setFavorites(prev => prev.filter(r => r._id !== room._id))
      }
    }
  }

  const removeFavorite = async (roomId: string) => {
    const removed = favorites.find(r => r._id === roomId)
    setFavorites(prev => prev.filter(r => r._id !== roomId))
    try {
      await removeFavoriteApi(roomId)
    } catch {
      // Rollback
      if (removed) setFavorites(prev => [removed, ...prev])
    }
  }

  const clearFavorites = () => setFavorites([])

  return (
    <FavoritesContext.Provider value={{ favorites, toggleFavorite, isFavorite, removeFavorite, clearFavorites, loading }}>
      {children}
    </FavoritesContext.Provider>
  )
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider')
  return ctx
}