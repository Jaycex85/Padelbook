export const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
}

export const PAYMENT_MODE = {
  FULL: 'full',
  SPLIT: 'split',
  WALLET: 'wallet',
}

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  REFUNDED: 'refunded',
  FAILED: 'failed',
}

export const USER_ROLE = {
  ADMIN: 'admin',
  MEMBER: 'member',
  PUBLIC: 'public',
}

export const BLOCK_REASON = {
  TOURNAMENT: 'tournament',
  MAINTENANCE: 'maintenance',
  EVENT: 'event',
  OTHER: 'other',
}

export const EVENT_TYPE = {
  BOOKING_CONFIRMED: 'booking.confirmed',
  BOOKING_CANCELLED: 'booking.cancelled',
  BOOKING_STARTED: 'booking.started',
  BOOKING_ENDED: 'booking.ended',
  PAYMENT_RECEIVED: 'payment.received',
  PAYMENT_FAILED: 'payment.failed',
  COURT_OPENED: 'court.opened',
  COURT_CLOSED: 'court.closed',
}

export const DAYS_OF_WEEK = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
