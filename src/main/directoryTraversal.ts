import fs from 'node:fs/promises'
import type { Dirent } from 'node:fs'

export interface DirectoryTraversal {
  isDirectory: boolean
  nextAncestors: Set<string> | null
}

export async function createDirectoryAncestors(root: string): Promise<Set<string>> {
  return new Set([await fs.realpath(root)])
}

export async function getDirectoryTraversal(
  entry: Dirent,
  absolutePath: string,
  ancestors: ReadonlySet<string>
): Promise<DirectoryTraversal> {
  if (!entry.isDirectory() && !entry.isSymbolicLink()) {
    return { isDirectory: false, nextAncestors: null }
  }

  try {
    if (entry.isSymbolicLink() && !(await fs.stat(absolutePath)).isDirectory()) {
      return { isDirectory: false, nextAncestors: null }
    }

    const realPath = await fs.realpath(absolutePath)
    if (ancestors.has(realPath)) {
      return { isDirectory: true, nextAncestors: null }
    }

    return {
      isDirectory: true,
      nextAncestors: new Set([...ancestors, realPath])
    }
  } catch {
    return { isDirectory: false, nextAncestors: null }
  }
}
