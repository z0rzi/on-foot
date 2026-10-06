// The template-literal return type, not string: typed routes accept only the generated Href union.
// encodeURIComponent rather than URLSearchParams, which form-encodes a space as '+'.
export function newTrailHref(uri: string, name?: string | null): `/trail/new?${string}` {
  const query = `uri=${encodeURIComponent(uri)}`
  return name ? `/trail/new?${query}&name=${encodeURIComponent(name)}` : `/trail/new?${query}`
}
