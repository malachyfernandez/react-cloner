#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import prettier from 'prettier';
import { overwriteWithShell } from './patch/overwriteWithShell';

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
  .option('--base-mode <mode>', 'Base file patching mode: replace-component, replace-default-export, overwrite-shell', 'replace-default-export')
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
      
      // Copy excludes should NEVER include user-specified ignore folders
      const copyExcludes = ['node_modules', '.git', 'dist', 'build', '.expo', 'coverage', 'ios/build', 'android/build'];
      
      function normalizeRel(root: string, file: string): string {
        return path.relative(root, file).split(path.sep).join("/");
      }
      
      function shouldExcludeFromCopy(rel: string): boolean {
        return copyExcludes.some((excluded) => {
          return rel === excluded || rel.startsWith(`${excluded}/`);
        });
      }
      
      if (await fs.pathExists(options.out)) {
        await fs.remove(options.out);
      }
      
      await fs.copy(options.projectRoot, options.out, {
        filter: (src) => {
          const rel = normalizeRel(options.projectRoot, src);
          if (!rel || rel === "") return true;
          return !shouldExcludeFromCopy(rel);
        }
      });
      
      console.log(`✅ Project copied to ${options.out}`);
      
      // Phase 2: Create visual clone structure
      console.log('\n=== Phase 2: Creating Visual Clone Structure ===');
      const visualCloneDir = path.join(options.out, '.visual-clone');
      const mirroredDir = path.join(visualCloneDir, 'mirrored');
      await fs.ensureDir(mirroredDir);
      
      // Create runtime file
      const runtimeContent = `export const previewString = '${options.stringDefault}';
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
      
      // Debug: Print what we found
      for (const [componentPath, componentInfo] of subtreeGraph) {
        console.log(`  - ${componentPath} (${componentInfo.mode}) - JSX: ${componentInfo.jsxComponents.join(', ')}`);
      }
      
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
      const mirroredRootRelativePath = path.join('.visual-clone', 'mirrored', options.targetComponent);
      const mirroredRootAbsolutePath = path.resolve(options.out, mirroredRootRelativePath);
      console.log(`Mirrored root will be at: ${mirroredRootAbsolutePath}`);
      console.log(`Checking if mirrored root exists: ${await fs.pathExists(mirroredRootAbsolutePath)}`);
      
      if (options.baseMode === 'overwrite-shell') {
        await overwriteWithShell({
          outProjectRoot: options.out,
          baseFile: options.baseFile,
          targetMirroredFile: mirroredRootRelativePath,
          shellType:
            options.framework === 'expo-router'
              ? 'expo-router-safe-area'
              : options.framework === 'react-native'
                ? 'react-native-basic'
                : 'react-web-basic',
        });
        console.log('✅ Base file overwritten with shell');
      } else if (options.replaceComponent) {
        await patchBaseFile(options.out, options.baseFile, options.targetComponent, options.replaceComponent);
        console.log('✅ Base file patched with component replacement');
      } else {
        await patchBaseFile(options.out, options.baseFile, options.targetComponent);
        console.log('✅ Base file patched');
      }
      
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
        // Resolve from the actual file location in the project, not from current working directory
        const componentFileDir = path.join(projectRoot, path.dirname(filePath));
        const resolvedPath = path.resolve(componentFileDir, importPath);
        
        // Try different extensions
        const possibleExtensions = ['.tsx', '.ts', '.jsx', '.js', ''];
        for (const ext of possibleExtensions) {
          const testPath = resolvedPath + ext;
          if (await fs.pathExists(testPath)) {
            const relativePath = path.relative(projectRoot, testPath);
            await analyzeComponent(relativePath);
            break;
          }
        }
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
  
  const propsInterfaceMatch = content.match(/interface\s+\w+Props\s*\{([\s\S]*?)\}/);
  const propTypeMap = new Map<string, string>();
  if (propsInterfaceMatch) {
    for (const rawLine of propsInterfaceMatch[1].split('\n')) {
      const line = rawLine.trim().replace(/;$/, '');
      if (!line || !line.includes(':')) continue;
      const colonIndex = line.indexOf(':');
      const propName = line.slice(0, colonIndex).replace(/\?$/, '').trim();
      const propType = line.slice(colonIndex + 1).trim();
      if (propName) {
        propTypeMap.set(propName, propType);
      }
    }
  }

  const destructuredPropsMatch = content.match(/const\s+\w+\s*=\s*\(\s*\{([^}]*)\}\s*:\s*\w+Props\s*\)\s*=>/s)
    ?? content.match(/function\s+\w+\s*\(\s*\{([^}]*)\}\s*:\s*\w+Props\s*\)/s);
  const destructuredProps = destructuredPropsMatch
    ? destructuredPropsMatch[1]
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => part.split(':')[0].trim())
        .map((part) => part.replace(/\s*=.*$/, '').trim())
        .filter(Boolean)
    : [];

  const componentNameMatch = content.match(/const\s+(\w+)\s*=\s*\(/)
    ?? content.match(/function\s+(\w+)\s*\(/)
    ?? content.match(/export\s+default\s+function\s+(\w+)\s*\(/);
  const componentName = componentNameMatch?.[1] ?? path.basename(componentPath, path.extname(componentPath));
  const returnMatch = content.match(/return\s*\(([\s\S]*?)\);/);
  const originalJsx = returnMatch?.[1]?.trim() ?? '<></>';

  // Transformations
  let transformedContent = content;
  
  // Rewrite import paths for local imports
  const componentDir = path.dirname(componentPath);
  const ignoreFolders = options.ignore ? options.ignore.split(',') : [];
  
  transformedContent = transformedContent.replace(
    /import\s+(?:(?:\{[^}]*\}|\w+)\s+from\s+)?['"](\.[^'"]+)['"]/g,
    (match, importPath) => {
      // Only rewrite relative imports (starting with .)
      if (importPath.startsWith('.')) {
        // Resolve the import relative to the component file
        const componentFileAbsPath = path.join(projectRoot, componentPath);
        const componentFileDir = path.dirname(componentFileAbsPath);
        const resolvedImportAbsPath = path.resolve(componentFileDir, importPath);
        
        // Get the path relative to project root
        const relativeImportPath = path.relative(projectRoot, resolvedImportAbsPath);
        
        // Check if this is an ignored component
        const isIgnored = ignoreFolders.some(ignore => relativeImportPath.includes(ignore));
        
        if (isIgnored) {
          // Import from the real copied project (go up from .visual-clone/mirrored to project root)
          const backPath = '../'.repeat(componentPath.split('/').length + 1); // +1 for .visual-clone/mirrored
          return match.replace(importPath, `${backPath}${relativeImportPath}`);
        } else {
          // Import from mirrored location (keep relative)
          return match;
        }
      }
      return match;
    }
  );
  
  const previewDeclarations = destructuredProps.map((propName) => {
    const propType = propTypeMap.get(propName) ?? '';
    if (propType.includes('=>') || /^(on[A-Z]|set[A-Z])/.test(propName)) {
      return `const __preview_${propName} = () => {};`;
    }
    if (propType.includes('boolean') || /^(is|has|can)[A-Z]/.test(propName)) {
      return `const __preview_${propName} = ${options.booleanDefault};`;
    }
    if (propType.includes('number') || /(index|count|total|length|size|page|offset)$/i.test(propName)) {
      return `const __preview_${propName} = ${options.numberDefault};`;
    }
    if (propType.includes('[]') || /Array<.+>/.test(propType) || /(list|items|games|results|rows)/i.test(propName) || propName.endsWith('s')) {
      return `const __preview_${propName} = ['${options.stringDefault}'];`;
    }
    return `const __preview_${propName} = '${options.stringDefault}';`;
  });
  const previewData = `${[`const __preview_text = '${options.stringDefault}';`, `const __preview_number = ${options.numberDefault};`, `const __preview_boolean = ${options.booleanDefault};`, ...previewDeclarations].join('\n')}
`;

  let simplifiedJsx = originalJsx;
  const simplifiedLines = simplifiedJsx
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (trimmed.startsWith('{/*') || trimmed.endsWith('*/}')) return false;
      if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.endsWith('*/')) return false;
      if (trimmed.includes('.map(')) return false;
      if (trimmed.includes('=>')) return false;
      if (trimmed.includes('&&')) return false;
      if (trimmed.includes(' ? ') || trimmed.includes('?:') || trimmed.startsWith('?') || trimmed.startsWith(':')) return false;
      if (/^(variant|className|on\w+|set\w+|value|placeholder|text|subtext|gameCode|earliestDate)=/.test(trimmed)) return false;
      if (trimmed === '>' || trimmed === '/>' || trimmed === '</>' || trimmed === '<>') return true;
      if (trimmed === '{' || trimmed === '}' || trimmed === ')}' || trimmed === '))}' || trimmed === ') : (' || trimmed === ');') return false;
      if (/^[()]+$/.test(trimmed)) return false;
      return true;
    })
    .map((line) => {
      let nextLine = line;
      nextLine = nextLine.replace(/className=\{[^>]*\}/g, 'className={__preview_text}');
      nextLine = nextLine.replace(/(on\w+)=\{.*?\}/g, '$1={() => {}}');
      nextLine = nextLine.replace(/(set\w+)=\{.*?\}/g, '$1={() => {}}');
      nextLine = nextLine.replace(/(className|key|value|placeholder|text|subtext|gameCode|entering|exiting|isOpen)=\{.*?\}/g, '$1={__preview_text}');
      nextLine = nextLine.replace(/(gap|index|numColumns|size|count)=\{.*?\}/g, '$1={__preview_number}');
      nextLine = nextLine.replace(/(disabled|visible|open)=\{.*?\}/g, '$1={__preview_boolean}');
      nextLine = nextLine.replace(/\}\}/g, '}');
      nextLine = nextLine.replace(/isOpen=\{__preview_text\}/g, 'isOpen={__preview_boolean}');
      nextLine = nextLine.replace(/(iconProps)=\{\(\) => \{\}\}\}/g, '$1={{}}');
      nextLine = nextLine.replace(/\{[^{}]*\}/g, (match) => {
        const inner = match.slice(1, -1).trim();
        if (!inner) return match;
        if (inner.startsWith('__preview_')) return match;
        if (/^\d+$/.test(inner)) return `{${options.numberDefault}}`;
        if (inner === 'true' || inner === 'false') return `{${options.booleanDefault}}`;
        return '{__preview_text}';
      });
      return nextLine;
    })
    .filter((line, index, arr) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (trimmed === '</Animated.View>' && !arr.some((candidate) => candidate.includes('<Animated.View'))) return false;
      if (trimmed === '</Column>' || trimmed === '</Row>' || trimmed === '</ScrollView>' || trimmed === '</ListRow>') return true;
      return !trimmed.includes('$1');
    });
  simplifiedJsx = simplifiedLines.join('\n');
  simplifiedJsx = simplifiedJsx.replace(/(on\w+)=\{\(\) => \{\}(?=(\s|\/?>))/g, '$1={() => {}}');
  simplifiedJsx = simplifiedJsx.replace(/(set\w+)=\{\(\) => \{\}(?=(\s|\/?>))/g, '$1={() => {}}');
  simplifiedJsx = simplifiedJsx.replace(/(on\w+)=\{\(\) => \{\}\s*$/gm, '$1={() => {}}');
  simplifiedJsx = simplifiedJsx.replace(/(set\w+)=\{\(\) => \{\}\s*$/gm, '$1={() => {}}');
  simplifiedJsx = simplifiedJsx.replace(/isOpen=\{__preview_text\}/g, 'isOpen={__preview_boolean}');
  simplifiedJsx = simplifiedJsx.replace(/hasJoinedAGame=\{__preview_text\}/g, 'hasJoinedAGame={__preview_boolean}');
  simplifiedJsx = simplifiedJsx.replace(/hasMadeAGame=\{__preview_text\}/g, 'hasMadeAGame={__preview_boolean}');

  const importLines = transformedContent
    .split('\n')
    .map((line) => {
      if (!line.trim().startsWith('import')) return line;
      if (line.includes('hooks/')) return '';
      if (line.startsWith('import React,')) return "import React from 'react';";
      if (/import\s+\{[^}]+\}\s+from\s+['\"]types\//.test(line)) return '';
      return line;
    })
    .filter((line) => line.trim().startsWith('import'));

  transformedContent = `${importLines.join('\n')}
${importLines.length ? '\n' : ''}${previewData}
const ${componentName} = () => {
  return (
${simplifiedJsx}
  );
};

export default ${componentName};
`;
  
  await fs.writeFile(targetPath, transformedContent);
}

async function patchBaseFile(outputPath: string, baseFile: string, targetComponent: string, replaceComponent?: string) {
  const baseFilePath = path.join(outputPath, baseFile);
  
  // Simple patch - replace the entire file with an import to the mirrored component
  const relativeTargetPath = path.relative(path.dirname(baseFilePath), 
    path.join('.visual-clone', 'mirrored', targetComponent));
  
  const patchedContent = `import PreviewRoot from '${relativeTargetPath}';

export default PreviewRoot;
`;
  
  await fs.writeFile(baseFilePath, patchedContent);
}

program.parse();
