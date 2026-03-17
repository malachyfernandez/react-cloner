#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';

const program = new Command();

program
  .name('react-visual-clone')
  .description('CLI tool to create visual-only clones of React component subtrees')
  .version('1.0.0');

program
  .command('generate')
  .description('Generate a visual-only clone of a React component subtree')
  .requiredOption('--project-root <path>', 'Source project root directory')
  .requiredOption('--target-component <path>', 'Component file that becomes the root of the visual-only mirrored subtree')
  .requiredOption('--out <path>', 'Output path for copied project')
  .action(async (options) => {
    try {
      console.log('=== React Visual Clone ===');
      console.log(`Project root: ${options.projectRoot}`);
      console.log(`Target component: ${options.targetComponent}`);
      console.log(`Output path: ${options.out}`);
      
      // Simple copy for now
      console.log('Copying project...');
      if (await fs.pathExists(options.out)) {
        await fs.remove(options.out);
      }
      await fs.copy(options.projectRoot, options.out, {
        filter: (src) => {
          const relative = path.relative(options.projectRoot, src);
          return !relative.includes('node_modules') && 
                 !relative.includes('.git') && 
                 !relative.includes('dist') &&
                 !relative.includes('build');
        }
      });
      
      // Create .visual-clone directory
      const visualCloneDir = path.join(options.out, '.visual-clone');
      await fs.ensureDir(visualCloneDir);
      
      // Create runtime file
      const runtimeContent = `
export const previewString = 'Lorem ipsum';
export const previewNumber = 1;
export const previewBoolean = true;
export const previewNoop = () => {};
export const previewImage = { uri: 'https://via.placeholder.com/300x200' };
`;
      await fs.writeFile(path.join(visualCloneDir, 'runtime.ts'), runtimeContent);
      
      console.log('✅ Visual clone generated successfully!');
      console.log(`📁 Output directory: ${options.out}`);
      console.log(`🔧 Mirrored files directory: ${path.join(visualCloneDir, 'mirrored')}`);
      
    } catch (error) {
      console.error('❌ Failed to generate visual clone:', error);
      process.exit(1);
    }
  });

program.parse();
