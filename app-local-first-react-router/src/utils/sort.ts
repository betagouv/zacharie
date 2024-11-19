export function sortLatestFirstByCreatedAt<T extends { created_at: string }>(a: T, b: T) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export function sortLatestFirstByUpdatedAt<T extends { updated_at: string }>(a: T, b: T) {
  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
}

export function sortEarliestFirstByCreatedAt<T extends { created_at: string }>(a: T, b: T) {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

export function sortEarliestFirstByUpdatedAt<T extends { updated_at: string }>(a: T, b: T) {
  return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
}
