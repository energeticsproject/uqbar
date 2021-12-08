import os from 'os'
import fs from 'fs'
import path from 'path'

export const getCached = (key: string, generator: () => any) => {
  let resolved = path.resolve(os.tmpdir(), key)
  if (fs.existsSync(resolved)) {
    return JSON.parse(fs.readFileSync(resolved, 'utf8'))
  }
  let value = generator()
  fs.writeFileSync(resolved, JSON.stringify(value))
  return value
}
