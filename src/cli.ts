#!/usr/bin/env node

import { Command } from 'commander';
import { generate } from './commands/generate';
import { loadConfig } from './config';
import { log } from './utils/log';

const program = new Command();

program
  .name('react-visual-clone')
  .description('CLI tool to create visual-only clones of React component subtrees')
  .version('1.0.0');

program
  .command('generate')
  .description('Generate a visual-only clone of a React component subtree')
  .requiredOption('--project-root <path>', 'Source project root directory')
  .requiredOption('--base-file <path>', 'File inside the app that should be patched in the copied project')
  .option('--replace-component <path>', 'Component inside base-file to replace with the preview root')
  .requiredOption('--target-component <path>', 'Component file that becomes the root of the visual-only mirrored subtree')
  .requiredOption('--out <path>', 'Output path for copied project')
  .option('--framework <type>', 'Framework type: expo-router, react-native, or react-web')
  .option('--ignore <paths>', 'Comma-separated folders that remain real and are never stripped')
  .option('--mode <type>', 'Transformation mode', 'visual-strip')
  .option('--root-export <name>', 'Export name if target file has multiple exports')
  .option('--array-length <number>', 'Default array length for preview data', '1')
  .option('--conditionals <boolean>', 'Whether conditionals should render visible content by default', 'true')
  .option('--string-default <value>', 'Default string value for preview', 'Lorem ipsum')
  .option('--number-default <value>', 'Default number value for preview', '1')
  .option('--boolean-default <value>', 'Default boolean value for preview', 'true')
  .option('--image-placeholder <url>', 'Placeholder image URL', 'https://via.placeholder.com/300x200')
  .action(async (options) => {
    try {
      // Load config file if it exists
      const config = await loadConfig(options.projectRoot);
      
      // Merge CLI options with config (CLI takes precedence)
      const mergedOptions = { ...config, ...options };
      
      log.info('Starting React Visual Clone generation...');
      log.info(`Project root: ${mergedOptions.projectRoot}`);
      log.info(`Target component: ${mergedOptions.targetComponent}`);
      log.info(`Output path: ${mergedOptions.out}`);
      
      await generate(mergedOptions);
      
      log.success('Visual clone generated successfully!');
    } catch (error) {
      log.error('Failed to generate visual clone:', error);
      process.exit(1);
    }
  });

program.parse();
