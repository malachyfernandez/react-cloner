import path from 'path';
import fs from 'fs-extra';
import { JS_EXTENSIONS } from '../utils/constants';

export async function resolveImport(
  importPath: string,
  fromFile: string,
  projectRoot: string
): Promise<string | null> {
  // Handle package imports (node_modules)
  if (!importPath.startsWith('.')) {
    return null; // Package import - don't resolve for subtree graph
  }
  
  const fromDir = path.dirname(fromFile);
  let resolvedPath = path.resolve(fromDir, importPath);
  
  // Try different extensions
  for (const ext of JS_EXTENSIONS) {
    const candidatePath = resolvedPath + ext;
    if (await fs.pathExists(candidatePath)) {
      return path.relative(projectRoot, candidatePath);
    }
  }
  
  // Try index files
  for (const ext of JS_EXTENSIONS) {
    const indexPath = path.join(resolvedPath, `index${ext}`);
    if (await fs.pathExists(indexPath)) {
      return path.relative(projectRoot, indexPath);
    }
  }
  
  return null; // Could not resolve
}
