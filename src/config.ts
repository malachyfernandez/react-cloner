import fs from 'fs-extra';
import path from 'path';
import { Config } from '../types';

export async function loadConfig(projectRoot: string): Promise<Config> {
  const configPath = path.join(projectRoot, '.react-visual-clonerc.json');
  
  if (await fs.pathExists(configPath)) {
    try {
      const configContent = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(configContent);
    } catch (error) {
      console.warn(`Failed to load config file at ${configPath}:`, error);
      return {};
    }
  }
  
  return {};
}
