import { parse } from '@babel/parser';
import { File } from '@babel/types';
import fs from 'fs-extra';

export async function parseFile(filePath: string): Promise<File> {
  const content = await fs.readFile(filePath, 'utf-8');
  return parse(content, {
    sourceType: 'module',
    plugins: [
      'typescript',
      'jsx',
      'classProperties',
      'decorators-legacy',
      'dynamicImport'
    ]
  });
}
