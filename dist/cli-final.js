#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const parser_1 = require("@babel/parser");
const traverse_1 = __importDefault(require("@babel/traverse"));
const overwriteWithShell_1 = require("./patch/overwriteWithShell");
const program = new commander_1.Command();
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
        function normalizeRel(root, file) {
            return path_1.default.relative(root, file).split(path_1.default.sep).join("/");
        }
        function shouldExcludeFromCopy(rel) {
            return copyExcludes.some((excluded) => {
                return rel === excluded || rel.startsWith(`${excluded}/`);
            });
        }
        if (await fs_extra_1.default.pathExists(options.out)) {
            await fs_extra_1.default.remove(options.out);
        }
        await fs_extra_1.default.copy(options.projectRoot, options.out, {
            filter: (src) => {
                const rel = normalizeRel(options.projectRoot, src);
                if (!rel || rel === "")
                    return true;
                return !shouldExcludeFromCopy(rel);
            }
        });
        console.log(`✅ Project copied to ${options.out}`);
        // Phase 2: Create visual clone structure
        console.log('\n=== Phase 2: Creating Visual Clone Structure ===');
        const visualCloneDir = path_1.default.join(options.out, '.visual-clone');
        const mirroredDir = path_1.default.join(visualCloneDir, 'mirrored');
        await fs_extra_1.default.ensureDir(mirroredDir);
        // Create runtime file
        const runtimeContent = `export const previewString = '${options.stringDefault}';
export const previewNumber = ${options.numberDefault};
export const previewBoolean = ${options.booleanDefault};
export const previewNoop = () => {};
export const previewImage = { uri: '${options.imagePlaceholder}' };
`;
        await fs_extra_1.default.writeFile(path_1.default.join(visualCloneDir, 'runtime.ts'), runtimeContent);
        console.log('✅ Runtime file created');
        // Phase 3: Build subtree graph and mirror components
        console.log('\n=== Phase 3: Building Subtree Graph ===');
        const targetComponentPath = path_1.default.resolve(options.projectRoot, options.targetComponent);
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
            }
            else {
                console.log(`📦 Kept real: ${componentPath}`);
            }
        }
        // Phase 5: Patch base file
        console.log('\n=== Phase 5: Patching Base File ===');
        const mirroredRootRelativePath = path_1.default.join('.visual-clone', 'mirrored', options.targetComponent);
        const mirroredRootAbsolutePath = path_1.default.resolve(options.out, mirroredRootRelativePath);
        console.log(`Mirrored root will be at: ${mirroredRootAbsolutePath}`);
        console.log(`Checking if mirrored root exists: ${await fs_extra_1.default.pathExists(mirroredRootAbsolutePath)}`);
        if (options.baseMode === 'overwrite-shell') {
            await (0, overwriteWithShell_1.overwriteWithShell)({
                outProjectRoot: options.out,
                baseFile: options.baseFile,
                targetMirroredFile: mirroredRootRelativePath,
                shellType: options.framework === 'expo-router'
                    ? 'expo-router-safe-area'
                    : options.framework === 'react-native'
                        ? 'react-native-basic'
                        : 'react-web-basic',
            });
            console.log('✅ Base file overwritten with shell');
        }
        else if (options.replaceComponent) {
            await patchBaseFile(options.out, options.baseFile, options.targetComponent, options.replaceComponent);
            console.log('✅ Base file patched with component replacement');
        }
        else {
            await patchBaseFile(options.out, options.baseFile, options.targetComponent);
            console.log('✅ Base file patched');
        }
        console.log('\n🎉 Visual clone generated successfully!');
        console.log(`📁 Output directory: ${options.out}`);
        console.log(`🔧 Mirrored files directory: ${mirroredDir}`);
    }
    catch (error) {
        console.error('❌ Failed to generate visual clone:', error);
        process.exit(1);
    }
});
async function buildSubtreeGraph(targetPath, projectRoot, ignoreFolders) {
    const graph = new Map();
    const visited = new Set();
    async function analyzeComponent(filePath) {
        if (visited.has(filePath))
            return;
        visited.add(filePath);
        const absolutePath = path_1.default.resolve(projectRoot, filePath);
        if (!await fs_extra_1.default.pathExists(absolutePath))
            return;
        const content = await fs_extra_1.default.readFile(absolutePath, 'utf-8');
        const ast = (0, parser_1.parse)(content, {
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
        (0, traverse_1.default)(ast, {
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
                const componentFileDir = path_1.default.join(projectRoot, path_1.default.dirname(filePath));
                const resolvedPath = path_1.default.resolve(componentFileDir, importPath);
                // Try different extensions
                const possibleExtensions = ['.tsx', '.ts', '.jsx', '.js', ''];
                for (const ext of possibleExtensions) {
                    const testPath = resolvedPath + ext;
                    if (await fs_extra_1.default.pathExists(testPath)) {
                        const relativePath = path_1.default.relative(projectRoot, testPath);
                        await analyzeComponent(relativePath);
                        break;
                    }
                }
            }
        }
    }
    const relativeTargetPath = path_1.default.relative(projectRoot, targetPath);
    await analyzeComponent(relativeTargetPath);
    return graph;
}
async function mirrorComponent(componentPath, componentInfo, projectRoot, mirroredDir, options) {
    const sourcePath = path_1.default.resolve(projectRoot, componentPath);
    const targetPath = path_1.default.join(mirroredDir, componentPath);
    await fs_extra_1.default.ensureDir(path_1.default.dirname(targetPath));
    let content = await fs_extra_1.default.readFile(sourcePath, 'utf-8');
    const propsInterfaceMatch = content.match(/interface\s+\w+Props\s*\{([\s\S]*?)\}/);
    const propTypeMap = new Map();
    if (propsInterfaceMatch) {
        for (const rawLine of propsInterfaceMatch[1].split('\n')) {
            const line = rawLine.trim().replace(/;$/, '');
            if (!line || !line.includes(':'))
                continue;
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
    // Transformations
    let transformedContent = content;
    // Rewrite import paths for local imports
    const componentDir = path_1.default.dirname(componentPath);
    const ignoreFolders = options.ignore ? options.ignore.split(',') : [];
    transformedContent = transformedContent.replace(/import\s+(?:(?:\{[^}]*\}|\w+)\s+from\s+)?['"](\.[^'"]+)['"]/g, (match, importPath) => {
        // Only rewrite relative imports (starting with .)
        if (importPath.startsWith('.')) {
            // Resolve the import relative to the component file
            const componentFileAbsPath = path_1.default.join(projectRoot, componentPath);
            const componentFileDir = path_1.default.dirname(componentFileAbsPath);
            const resolvedImportAbsPath = path_1.default.resolve(componentFileDir, importPath);
            // Get the path relative to project root
            const relativeImportPath = path_1.default.relative(projectRoot, resolvedImportAbsPath);
            // Check if this is an ignored component
            const isIgnored = ignoreFolders.some(ignore => relativeImportPath.includes(ignore));
            if (isIgnored) {
                // Import from the real copied project (go up from .visual-clone/mirrored to project root)
                const backPath = '../'.repeat(componentPath.split('/').length + 1); // +1 for .visual-clone/mirrored
                return match.replace(importPath, `${backPath}${relativeImportPath}`);
            }
            else {
                // Import from mirrored location (keep relative)
                return match;
            }
        }
        return match;
    });
    // Remove interface definitions
    transformedContent = transformedContent.replace(/interface\s+\w+Props\s*\{[^}]*\}/gs, '');
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
    const previewData = [`const __preview_text = '${options.stringDefault}';`, `const __preview_number = ${options.numberDefault};`, ...previewDeclarations].length > 0 ? `${[`const __preview_text = '${options.stringDefault}';`, `const __preview_number = ${options.numberDefault};`, ...previewDeclarations].join('\n')}
` : '';
    const defaultedProps = destructuredProps
        .map((propName) => `${propName} = __preview_${propName}`)
        .join(', ');
    if (defaultedProps) {
        transformedContent = transformedContent.replace(/const\s+(\w+)\s*=\s*\(\{[^}]*\}\s*:\s*\w+Props\)\s*=>/g, `const $1 = ({ ${defaultedProps} } = {}) =>`);
        transformedContent = transformedContent.replace(/function\s+(\w+)\s*\(\{[^}]*\}\s*:\s*\w+Props\)\s*\{/g, `function $1({ ${defaultedProps} } = {}) {`);
    }
    else {
        transformedContent = transformedContent.replace(/const\s+(\w+)\s*=\s*\(\{[^}]*\}\s*:\s*\w+Props\)\s*=>/g, 'const $1 = () =>');
        transformedContent = transformedContent.replace(/function\s+(\w+)\s*\(\{[^}]*\}\s*:\s*\w+Props\)\s*\{/g, 'function $1() {');
    }
    transformedContent = transformedContent.replace(/^import\s+\{[^}]*use\w+[^}]*\}\s+from\s+['"][^'"]*hooks\/[^'"]+['"];?\s*$/gm, '');
    transformedContent = transformedContent.replace(/^import\s+use\w+\s+from\s+['"][^'"]*hooks\/[^'"]+['"];?\s*$/gm, '');
    transformedContent = transformedContent.replace(/const\s+(\w+)\s*=\s*use[A-Z]\w*\(([\s\S]*?)\)\s*/g, `const $1 = [{ value: { name: '${options.stringDefault}', id: '${options.stringDefault}' } }];\n`);
    transformedContent = transformedContent.replace(/\b\w+\.value\.[A-Za-z_$][\w$]*/g, '__preview_text');
    transformedContent = transformedContent.replace(/\b\w+\?\.\[\d+\]\?*\.value\?*\.[A-Za-z_$][\w$]*/g, '__preview_text');
    transformedContent = transformedContent.replace(/(\w+)\?\.\[(\d+)\]\.value\.name/g, '$1?.[$2]?.value?.name');
    transformedContent = transformedContent.replace(/(\w+)\?\.\[(\d+)\]\.value\.id/g, '$1?.[$2]?.value?.id');
    // Insert after imports
    const importLines = transformedContent.split('\n');
    let insertIndex = 0;
    for (let i = 0; i < importLines.length; i++) {
        if (importLines[i].trim().startsWith('import')) {
            insertIndex = i + 1;
        }
        else if (insertIndex > 0 && !importLines[i].trim().startsWith('import') && importLines[i].trim() !== '') {
            break;
        }
    }
    importLines.splice(insertIndex, 0, previewData);
    transformedContent = importLines.join('\n');
    // Replace handlers
    transformedContent = transformedContent.replace(/\b(on\w+)\s*=\{[^}]*\}/g, '$1={() => {}}');
    transformedContent = transformedContent.replace(/\b(set\w+)\s*=\{[^}]*\}/g, '$1={() => {}}');
    // Replace dynamic expressions in JSX only (not in import statements)
    // First, split by import statements to avoid touching them
    const lines = transformedContent.split('\n');
    const resultLines = [];
    let inImportSection = true;
    for (const line of lines) {
        if (inImportSection && !line.trim().startsWith('import') && line.trim() !== '') {
            inImportSection = false;
        }
        if (inImportSection) {
            resultLines.push(line);
        }
        else {
            const trimmedLine = line.trim();
            const looksLikeJsxLine = trimmedLine.includes('<') || trimmedLine.includes('>');
            if (!looksLikeJsxLine) {
                resultLines.push(line);
                continue;
            }
            let simplifiedLine = line;
            simplifiedLine = simplifiedLine.replace(/className=\{.*?\}(?=(\s+[A-Za-z_]\w*=|\s*\/?>))/g, 'className={__preview_text}');
            simplifiedLine = simplifiedLine.replace(/key=\{.*?\}(?=(\s+[A-Za-z_]\w*=|\s*\/?>))/g, 'key={__preview_text}');
            simplifiedLine = simplifiedLine.replace(/gap=\{.*?\}(?=(\s+[A-Za-z_]\w*=|\s*\/?>))/g, 'gap={__preview_number}');
            simplifiedLine = simplifiedLine.replace(/index=\{.*?\}(?=(\s+[A-Za-z_]\w*=|\s*\/?>))/g, 'index={__preview_number}');
            simplifiedLine = simplifiedLine.replace(/onPress=\{.*?\}(?=(\s+[A-Za-z_]\w*=|\s*\/?>))/g, 'onPress={() => {}}');
            simplifiedLine = simplifiedLine.replace(/on\w+=\{.*?\}(?=(\s+[A-Za-z_]\w*=|\s*\/?>))/g, (match) => match.replace(/=\{.*?\}(?=(\s+[A-Za-z_]\w*=|\s*\/?>))/, '={() => {}}'));
            simplifiedLine = simplifiedLine.replace(/set\w+=\{.*?\}(?=(\s+[A-Za-z_]\w*=|\s*\/?>))/g, (match) => match.replace(/=\{.*?\}(?=(\s+[A-Za-z_]\w*=|\s*\/?>))/, '={() => {}}'));
            // Only replace dynamic expressions on JSX-ish lines
            resultLines.push(simplifiedLine.replace(/\{([^{}]+)\}/g, (match, content) => {
                const trimmed = content.trim();
                // Preserve common variable names and expressions
                if (trimmed.includes('__preview_') ||
                    trimmed.includes('styles.') ||
                    /^\d+$/.test(trimmed) ||
                    trimmed === 'true' ||
                    trimmed === 'false') {
                    return match;
                }
                if (/^[a-zA-Z_$][\w$]*$/.test(trimmed) && !trimmed.startsWith('__preview_')) {
                    return '{__preview_text}';
                }
                return '{__preview_text}';
            }));
        }
    }
    transformedContent = resultLines.join('\n');
    await fs_extra_1.default.writeFile(targetPath, transformedContent);
}
async function patchBaseFile(outputPath, baseFile, targetComponent, replaceComponent) {
    const baseFilePath = path_1.default.join(outputPath, baseFile);
    // Simple patch - replace the entire file with an import to the mirrored component
    const relativeTargetPath = path_1.default.relative(path_1.default.dirname(baseFilePath), path_1.default.join('.visual-clone', 'mirrored', targetComponent));
    const patchedContent = `import PreviewRoot from '${relativeTargetPath}';

export default PreviewRoot;
`;
    await fs_extra_1.default.writeFile(baseFilePath, patchedContent);
}
program.parse();
