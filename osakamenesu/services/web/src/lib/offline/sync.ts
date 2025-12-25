/**
 * Offline data synchronization utilities
 */

import Dexie, { Table } from 'dexie'

// Define database schema
interface PendingReservation {
  id: string
  shopId: string
  therapistId: string
  userId: string
  date: string
  time: string
  duration: number
  status: 'pending' | 'syncing' | 'failed'
  createdAt: Date
  retryCount: number
  lastError?: string
}

interface CachedShop {
  id: string
  name: string
  area: string
  imageUrl?: string
  rating?: number
  reviewCount?: number
  cachedAt: Date
}

interface CachedTherapist {
  id: string
  shopId: string
  name: string
  imageUrl?: string
  rating?: number
  isAvailable: boolean
  cachedAt: Date
}

interface SyncLog {
  id?: number
  action: string
  entityType: string
  entityId: string
  timestamp: Date
  success: boolean
  error?: string
}

// Create Dexie database
class OsakamenesuDB extends Dexie {
  pendingReservations!: Table<PendingReservation>
  cachedShops!: Table<CachedShop>
  cachedTherapists!: Table<CachedTherapist>
  syncLogs!: Table<SyncLog>

  constructor() {
    super('osakamenesu')

    this.version(1).stores({
      pendingReservations: 'id, shopId, therapistId, userId, status, createdAt',
      cachedShops: 'id, area, cachedAt',
      cachedTherapists: 'id, shopId, cachedAt',
      syncLogs: '++id, action, entityType, timestamp',
    })
  }
}

// Initialize database
export const db = new OsakamenesuDB()

/**
 * Offline sync manager
 */
export class OfflineSyncManager {
  private syncInProgress = false
  private syncInterval: number | null = null

  /**
   * Start periodic sync
   */
  startPeriodicSync(intervalMs: number = 30000) {
    if (this.syncInterval) {
      this.stopPeriodicSync()
    }

    this.syncInterval = window.setInterval(() => {
      if (navigator.onLine && !this.syncInProgress) {
        this.sync()
      }
    }, intervalMs)

    // Also sync when coming back online
    window.addEventListener('online', this.handleOnline)
  }

  /**
   * Stop periodic sync
   */
  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }

    window.removeEventListener('online', this.handleOnline)
  }

  /**
   * Handle online event
   */
  private handleOnline = () => {
    // Sync after a short delay to ensure network is stable
    setTimeout(() => {
      if (!this.syncInProgress) {
        this.sync()
      }
    }, 2000)
  }

  /**
   * Sync all pending data
   */
  async sync(): Promise<void> {
    if (this.syncInProgress) return

    this.syncInProgress = true

    try {
      await this.syncPendingReservations()
      await this.cleanupOldCache()

      // Log successful sync
      await this.logSync('full_sync', 'system', 'all', true)
    } catch (error) {
      console.error('Sync failed:', error)
      await this.logSync('full_sync', 'system', 'all', false, error)
    } finally {
      this.syncInProgress = false
    }
  }

  /**
   * Sync pending reservations
   */
  private async syncPendingReservations(): Promise<void> {
    const pendingReservations = await db.pendingReservations
      .where('status')
      .equals('pending')
      .toArray()

    for (const reservation of pendingReservations) {
      try {
        // Update status to syncing
        await db.pendingReservations.update(reservation.id, {
          status: 'syncing',
        })

        // Send to server
        const response = await fetch('/api/v1/reservations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Add auth headers if needed
          },
          body: JSON.stringify({
            shopId: reservation.shopId,
            therapistId: reservation.therapistId,
            date: reservation.date,
            time: reservation.time,
            duration: reservation.duration,
          }),
        })

        if (response.ok) {
          // Remove from pending
          await db.pendingReservations.delete(reservation.id)
          await this.logSync('reservation', 'reservation', reservation.id, true)
        } else {
          // Handle error
          const error = await response.text()
          await this.handleSyncError(reservation, error)
        }
      } catch (error) {
        await this.handleSyncError(reservation, error)
      }
    }
  }

  /**
   * Handle sync error
   */
  private async handleSyncError(
    reservation: PendingReservation,
    error: any
  ): Promise<void> {
    const errorMessage = error?.message || String(error)
    const retryCount = reservation.retryCount + 1

    if (retryCount >= 3) {
      // Max retries reached, mark as failed
      await db.pendingReservations.update(reservation.id, {
        status: 'failed',
        retryCount,
        lastError: errorMessage,
      })
    } else {
      // Update retry count and revert to pending
      await db.pendingReservations.update(reservation.id, {
        status: 'pending',
        retryCount,
        lastError: errorMessage,
      })
    }

    await this.logSync('reservation', 'reservation', reservation.id, false, error)
  }

  /**
   * Clean up old cached data
   */
  private async cleanupOldCache(): Promise<void> {
    const maxAge = 24 * 60 * 60 * 1000 // 24 hours
    const cutoffDate = new Date(Date.now() - maxAge)

    await db.cachedShops.where('cachedAt').below(cutoffDate).delete()
    await db.cachedTherapists.where('cachedAt').below(cutoffDate).delete()
  }

  /**
   * Log sync operation
   */
  private async logSync(
    action: string,
    entityType: string,
    entityId: string,
    success: boolean,
    error?: any
  ): Promise<void> {
    await db.syncLogs.add({
      action,
      entityType,
      entityId,
      timestamp: new Date(),
      success,
      error: error?.message || error?.toString(),
    })

    // Keep only last 100 logs
    const count = await db.syncLogs.count()
    if (count > 100) {
      const oldLogs = await db.syncLogs.orderBy('id').limit(count - 100).toArray()
      await db.syncLogs.bulkDelete(oldLogs.map(log => log.id!))
    }
  }
}

// Singleton instance
export const syncManager = new OfflineSyncManager()

/**
 * Save reservation for offline sync
 */
export async function saveReservationOffline(
  reservation: Omit<PendingReservation, 'id' | 'status' | 'createdAt' | 'retryCount'>
): Promise<string> {
  const id = `reservation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  await db.pendingReservations.add({
    ...reservation,
    id,
    status: 'pending',
    createdAt: new Date(),
    retryCount: 0,
  })

  // Trigger background sync if supported
  if ('sync' in self.registration) {
    await self.registration.sync.register('sync-reservations')
  }

  return id
}

/**
 * Cache shop data for offline access
 */
export async function cacheShopData(shops: CachedShop[]): Promise<void> {
  const shopsWithTimestamp = shops.map(shop => ({
    ...shop,
    cachedAt: new Date(),
  }))

  await db.cachedShops.bulkPut(shopsWithTimestamp)
}

/**
 * Cache therapist data for offline access
 */
export async function cacheTherapistData(therapists: CachedTherapist[]): Promise<void> {
  const therapistsWithTimestamp = therapists.map(therapist => ({
    ...therapist,
    cachedAt: new Date(),
  }))

  await db.cachedTherapists.bulkPut(therapistsWithTimestamp)
}

/**
 * Get cached shops
 */
export async function getCachedShops(area?: string): Promise<CachedShop[]> {
  if (area) {
    return db.cachedShops.where('area').equals(area).toArray()
  }
  return db.cachedShops.toArray()
}

/**
 * Get cached therapists
 */
export async function getCachedTherapists(shopId: string): Promise<CachedTherapist[]> {
  return db.cachedTherapists.where('shopId').equals(shopId).toArray()
}

/**
 * Get pending reservations count
 */
export async function getPendingReservationsCount(): Promise<number> {
  return db.pendingReservations.where('status').equals('pending').count()
}

/**
 * Clear all offline data
 */
export async function clearOfflineData(): Promise<void> {
  await db.pendingReservations.clear()
  await db.cachedShops.clear()
  await db.cachedTherapists.clear()
  await db.syncLogs.clear()
}