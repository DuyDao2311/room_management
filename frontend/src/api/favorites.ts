import api from './axios';

export interface Room {
  _id: string;
  name: string;
  address: string;
  price: number;
  area: number;
  type: string;
  status: 'available' | 'occupied' | 'maintenance';
  description: string;
  amenities: string[];
  images: string[];
}

// ── Get all favorites ─────────────────────────────────────────────────────────
export const getFavorites = (): Promise<Room[]> =>
  api.get('/favorites').then((r) => r.data);

// ── Add to favorites ─────────────────────────────────────────────────────────
export const addFavorite = (roomId: string): Promise<{ message: string }> =>
  api.post(`/favorites/${roomId}`).then((r) => r.data);

// ── Remove from favorites ────────────────────────────────────────────────────
export const removeFavorite = (roomId: string): Promise<{ message: string }> =>
  api.delete(`/favorites/${roomId}`).then((r) => r.data);

// ── Check if a room is favorited ─────────────────────────────────────────────
export const checkFavorite = (roomId: string): Promise<{ isFavorite: boolean }> =>
  api.get(`/favorites/check/${roomId}`).then((r) => r.data);

// ── Toggle favorite (convenience method) ─────────────────────────────────────
export const toggleFavorite = async (roomId: string): Promise<{ isFavorite: boolean; message: string }> => {
  try {
    const { isFavorite } = await checkFavorite(roomId);
    if (isFavorite) {
      const result = await removeFavorite(roomId);
      return { isFavorite: false, message: result.message };
    } else {
      const result = await addFavorite(roomId);
      return { isFavorite: true, message: result.message };
    }
  } catch (error: any) {
    if (error.response?.status === 404) {
      const result = await addFavorite(roomId);
      return { isFavorite: true, message: result.message };
    }
    throw error;
  }
};
