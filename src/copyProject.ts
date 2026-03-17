import fs from 'fs-extra';
import path from 'path';
import fg from 'fast-glob';
import { DEFAULT_IGNORE_PATTERNS } from '../utils/constants';
import { log } from '../utils/log';

export async function copyProject(
  projectRoot: string,
  outputPath: string,
  additionalIgnorePatterns: string[] = []
): Promise<void> {
  log.info(`Copying project from ${projectRoot} to ${outputPath}`);
  
  // Ensure output directory doesn't exist or is empty
  if (await fs.pathExists(outputPath)) {
    await fs.remove(outputPath);
  }
  await fs.ensureDir(outputPath);
  
  // Combine default ignore patterns with user-provided ones
  const ignorePatterns = [
    ...DEFAULT_IGNORE_PATTERNS,
    ...additionalIgnorePatterns
  ];
  
  // Create glob patterns for ignoring
  const ignoreGlobPatterns = ignorePatterns.map(pattern => `**/${pattern}`);
  
  try {
    // Get all files to copy (excluding ignored patterns)
    const entries = await fg('**/*', {
      cwd: projectRoot,
      dot: true,
      onlyFiles: false,
      ignore: ignoreGlobPatterns
    });
    
    log.info(`Found ${entries.length} entries to copy`);
    
    // Copy each entry
    for (const entry of entries) {
      const srcPath = path.join(projectRoot, entry);
      const destPath = path.join(outputPath, entry);
      
      // Ensure parent directory exists
      await fs.ensureDir(path.dirname(destPath));
      
      // Copy the entry (preserving file/directory structure)
      await fs.copy(srcPath, destPath);
    }
    
    log.success(`Project copied successfully to ${outputPath}`);
  } catch (error) {
    log.error('Failed to copy project:', error);
    throw error;
  }
}
