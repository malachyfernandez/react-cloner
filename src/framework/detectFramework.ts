import fs from 'fs-extra';
import path from 'path';
import { Framework } from '../types';
import { log } from '../utils/log';

export async function detectFramework(projectRoot: string): Promise<Framework> {
  log.info('Detecting framework...');
  
  // Check for Expo Router
  const appLayoutPath = path.join(projectRoot, 'app', '_layout.tsx');
  if (await fs.pathExists(appLayoutPath)) {
    log.info('Detected framework: expo-router');
    return 'expo-router';
  }
  
  // Check for React Native
  const appTsxPath = path.join(projectRoot, 'App.tsx');
  if (await fs.pathExists(appTsxPath)) {
    log.info('Detected framework: react-native');
    return 'react-native';
  }
  
  // Check for React Web
  const srcAppPath = path.join(projectRoot, 'src', 'App.tsx');
  if (await fs.pathExists(srcAppPath)) {
    log.info('Detected framework: react-web');
    return 'react-web';
  }
  
  // Fallback - try to guess based on package.json
  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (await fs.pathExists(packageJsonPath)) {
    const packageJson = await fs.readJson(packageJsonPath);
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    if (deps['expo'] || deps['expo-router']) {
      log.info('Detected framework: expo-router (from package.json)');
      return 'expo-router';
    }
    
    if (deps['react-native']) {
      log.info('Detected framework: react-native (from package.json)');
      return 'react-native';
    }
  }
  
  log.warn('Could not detect framework, defaulting to react-web');
  return 'react-web';
}
