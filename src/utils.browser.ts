export const getCached = (key: string, generator: () => string) => {
  let value = sessionStorage.getItem(key)
  if (typeof value === 'string') {
    return JSON.parse(value)
  }
  value = generator()
  sessionStorage.setItem(key, JSON.stringify(value))
  return value
}
