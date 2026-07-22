/**
 * Re-exported so client components can check `instanceof ApiError` on a
 * query/mutation's error without reaching past the query layer into
 * `lib/api` directly — the class itself is just a shared error shape, not
 * a fetch call.
 */
export { ApiError } from '@/lib/api/request'
