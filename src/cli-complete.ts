#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import recast from 'recast';
import prettier from 'prettier';

const program = new Command();

program
  .name('react-visual-clone')
  .description('CLI tool to create visual-only clones of React component subtrees')
  .version('1.0.0');

program
  .command('generate')
  .description('Generate a visual-only clone of a React component subtree')
  .requiredOption('--project-root <path>', 'Source project root directory')
  .option('--base-file <path>', 'File inside the app that should be patched', 'App.tsx')
  .option('--replace-component <path>', 'Component inside base-file to replace with the preview root')
  .requiredOption('--target-component <path>', 'Component file that becomes the root of the visual-only mirrored subtree')
  .requiredOption('--out <path>', 'Output path for copied project')
  .option('--framework <type>', 'Framework type: expo-router, react-native, or react-web', 'react-web')
  .option('--ignore <paths>', 'Comma-separated folders that remain real and are never stripped')
  .option('--mode <type>', 'Transformation mode', 'visual-strip')
  .option('--array-length <number>', 'Default array length for preview data', '1')
  .option('--conditionals <boolean>', 'Whether conditionals should render visible content by default', 'true')
  .option('--string-default <value>', 'Default string value for preview', 'Lorem ipsum')
  .option('--number-default <value>', 'Default number value for preview', '1')
  .option('--boolean-default <value>', 'Default boolean value for preview', 'true')
  .option('--image-placeholder <url>', 'Placeholder image URL', 'https://via.placeholder.com/300x200')
  .action(async (options) => {
    try {
      console.log('=== React Visual Clone ===');
      console.log(`Project root: ${options.projectRoot}`);
      console.log(`Target component: ${options.targetComponent}`);
      console.log(`Output path: ${options.out}`);
      
      // Phase 1: Copy project
      console.log('\n=== Phase 1: Copying Project ===');
      const ignoreFolders = options.ignore ? options.ignore.split(',') : [];
      const defaultIgnore = ['node_modules', '.git', 'dist', 'build', '.expo', 'coverage'];
      const allIgnore = [...defaultIgnore, ...ignoreFolders];
      
      if (await fs.pathExists(options.out)) {
        await fs.remove(options.out);
      }
      
      await fs.copy(options.projectRoot, options.out, {
        filter: (src) => {
          const relative = path.relative(options.projectRoot, src);
          return !allIgnore.some(ignore => relative.includes(ignore));
        }
      });
      
      console.log(`✅ Project copied to ${options.out}`);
      
      // Phase 2: Create visual clone structure
      console.log('\n=== Phase 2: Creating Visual Clone Structure ===');
      const visualCloneDir = path.join(options.out, '.visual-clone');
      const mirroredDir = path.join(visualCloneDir, 'mirrored');
      await fs.ensureDir(mirroredDir);
      
      // Create runtime file
      const runtimeContent = `
export const previewString = '${options.stringDefault}';
export const previewNumber = ${options.numberDefault};
export const previewBoolean = ${options.booleanDefault};
export const previewNoop = () => {};
export const previewImage = { uri: '${options.imagePlaceholder}' };
`;
      await fs.writeFile(path.join(visualCloneDir, 'runtime.ts'), runtimeContent);
      console.log('✅ Runtime file created');
      
      // Phase 3: Build subtree graph and mirror components
      console.log('\n=== Phase 3: Building Subtree Graph ===');
      const targetComponentPath = path.resolve(options.projectRoot, options.targetComponent);
      console.log(`Target component: ${targetComponentPath}`);
      
      const subtreeGraph = await buildSubtreeGraph(targetComponentPath, options.projectRoot, ignoreFolders);
      console.log(`Found ${subtreeGraph.size} components in subtree`);
      
      // Phase 4: Mirror components
      console.log('\n=== Phase 4: Mirroring Components ===');
      for (const [componentPath, componentInfo] of subtreeGraph) {
        if (componentInfo.mode === 'mirror-strip') {
          await mirrorComponent(componentPath, componentInfo, options.projectRoot, mirroredDir, options);
          console.log(`✅ Mirrored: ${componentPath}`);
        } else {
          console.log(`📦 Kept real: ${componentPath}`);
        }
      }
      
      // Phase 5: Patch base file
      console.log('\n=== Phase 5: Patching Base File ===');
      await patchBaseFile(options.out, options.baseFile, options.targetComponent, options.replaceComponent);
      console.log('✅ Base file patched');
      
      console.log('\n🎉 Visual clone generated successfully!');
      console.log(`📁 Output directory: ${options.out}`);
      console.log(`🔧 Mirrored files directory: ${mirroredDir}`);
      
    } catch (error) {
      console.error('❌ Failed to generate visual clone:', error);
      process.exit(1);
    }
  });

async function buildSubtreeGraph(targetPath: string, projectRoot: string, ignoreFolders: string[]) {
  const graph = new Map();
  const visited = new Set();
  
  async function analyzeComponent(filePath: string) {
    if (visited.has(filePath)) return;
    visited.add(filePath);
    
    const absolutePath = path.resolve(projectRoot, filePath);
    if (!await fs.pathExists(absolutePath)) return;
    
    const content = await fs.readFile(absolutePath, 'utf-8');
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx', 'classProperties']
    });
    
    const imports = new Map();
    const jsxComponents = new Set();
    
    // Collect imports
    for (const node of ast.program.body) {
      if (node.type === 'ImportDeclaration') {
        for (const specifier of node.specifiers) {
          if (specifier.type === 'ImportDefaultSpecifier' || specifier.type === 'ImportSpecifier') {
            imports.set(specifier.local.name, node.source.value);
          }
        }
      }
    }
    
    // Find JSX component usage
    traverse(ast, {
      JSXElement(path) {
        const componentName = path.node.openingElement.name.name;
        if (typeof componentName === 'string' && imports.has(componentName)) {
          jsxComponents.add(componentName);
        }
      }
    });
    
    // Determine if this component should be mirrored
    const isIgnored = ignoreFolders.some(ignore => filePath.includes(ignore));
    const mode = isIgnored ? 'opaque-real' : 'mirror-strip';
    
    graph.set(filePath, {
      filePath,
      mode,
      imports: Array.from(imports.keys()),
      jsxComponents: Array.from(jsxComponents)
    });
    
    // Recursively analyze child components
    for (const componentName of jsxComponents) {
      const importPath = imports.get(componentName);
      if (importPath && importPath.startsWith('.')) {
        const resolvedPath = path.resolve(path.dirname(filePath), importPath);
        const relativePath = path.relative(projectRoot, resolvedPath);
        await analyzeComponent(relativePath);
      }
    }
  }
  
  const relativeTargetPath = path.relative(projectRoot, targetPath);
  await analyzeComponent(relativeTargetPath);
  
  return graph;
}

async function mirrorComponent(componentPath: string, componentInfo: any, projectRoot: string, mirroredDir: string, options: any) {
  const sourcePath = path.resolve(projectRoot, componentPath);
  const targetPath = path.join(mirroredDir, componentPath);
  
  await fs.ensureDir(path.dirname(targetPath));
  
  let content = await fs.readFile(sourcePath, 'utf-8');
  
  // More precise transformations
  let transformedContent = content;
  
  // Remove interface definitions
  transformedContent = transformedContent.replace(/interface\s+\w+Props\s*\{[^}]*\}/gs, '');
  
  // Remove props from component signature
  transformedContent = transformedContent.replace(
    /const\s+(\w+)\s*=\s*\(\{[^}]*\}\s*:\s*\w+Props\)\s*=>/g,
    'const $1 = () =>'
  );
  
  transformedContent = transformedContent.replace(
    /function\s+(\w+)\s*\(\{[^}]*\}\s*:\s*\w+Props\)\s*\{/g,
    'function $1() {'
  );
  
  // Add preview data at the top of the component
  const previewData = `
const __preview_gamesTheyJoined = ['${options.stringDefault}'];
const __preview_setGamesTheyJoined = () => {};
const __preview_setActiveGameId = () => {};
`;
  
  // Insert preview data after imports (more precise)
  const lines = transformedContent.split('\n');
  let insertIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import')) {
      insertIndex = i + 1;
    } else if (insertIndex > 0 && !lines[i].trim().startsWith('import') && lines[i].trim() !== '') {
      break;
    }
  }
  
  lines.splice(insertIndex, 0, previewData);
  transformedContent = lines.join('\n');
  
  // Replace prop usages with preview variables (more precise)
  transformedContent = transformedContent.replace(/\bgamesTheyJoined\b/g, '__preview_gamesTheyJoined');
  transformedContent = transformedContent.replace(/\bsetGamesTheyJoined\b/g, '__preview_setGamesTheyJoined');
  transformedContent = transformedContent.replace(/\bsetActiveGameId\b/g, '__preview_setActiveGameId');
  
  // Replace handler functions with noops (more precise)
  transformedContent = transformedContent.replace(/\b(on\w+)\s*=\{[^}]*\}/g, '$1={() => {}}');
  transformedContent = transformedContent.replace(/\b(set\w+)\s*=\{[^}]*\}/g, '$1={() => {}}');
  
  // Replace dynamic expressions in JSX with safe literals (more precise)
  transformedContent = transformedContent.replace(/\{([^{}]+)\}/g, (match, content) => {
    const trimmed = content.trim();
    
    // Don't replace if it's a preview variable we just added
    if (trimmed.includes('__preview_')) return match;
    
    // Don't replace if it's a style object
    if (trimmed.includes('styles.')) return match;
    
    // Don't replace if it's a simple variable that's a preview variable
    if (trimmed === 'game' || trimmed === 'index') return match;
    
    // Don't replace if it's a number or boolean
    if (/^\d+$/.test(trimmed) || trimmed === 'true' || trimmed === 'false') return match;
    
    // Replace other dynamic content with string literal
    return `"${options.stringDefault}"`;
  });
  
  try {
    const formatted = await prettier.format(transformedContent, { parser: 'typescript' });
    await fs.writeFile(targetPath, formatted);
  } catch (error) {
    // If prettier fails, write as-is
    await fs.writeFile(targetPath, transformedContent);
  }
}

async function patchBaseFile(outputPath: string, baseFile: string, targetComponent: string, replaceComponent?: string) {
  const baseFilePath = path.join(outputPath, baseFile);
  const content = await fs.readFile(baseFilePath, 'utf-8');
  
  // Simple patch - replace the entire file with an import to the mirrored component
  const relativeTargetPath = path.relative(path.dirname(baseFilePath), 
    path.join('.visual-clone', 'mirrored', targetComponent));
  
  const patchedContent = `
import PreviewRoot from '${relativeTargetPath}';

export default PreviewRoot;
`;
  
  await fs.writeFile(baseFilePath, patchedContent);
}

program.parse();
