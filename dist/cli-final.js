#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const fast_glob_1 = __importDefault(require("fast-glob"));
const parser_1 = require("@babel/parser");
const traverse_1 = __importDefault(require("@babel/traverse"));
const generator_1 = __importDefault(require("@babel/generator"));
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
    .option('--skip-components <components>', 'Comma-separated JSX component names to remove entirely')
    .option('--mirror-all', 'Mirror every component file in the project, not just the target subtree', false)
    .action(async (options) => {
    try {
        console.log('=== React Visual Clone ===');
        console.log(`Project root: ${options.projectRoot}`);
        console.log(`Target component: ${options.targetComponent}`);
        console.log(`Output path: ${options.out}`);
        const skipComponents = options.skipComponents
            ? options.skipComponents.split(',').map((name) => name.trim()).filter(Boolean)
            : [];
        options.skipComponentNameSet = new Set(skipComponents);
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
        if (options.mirrorAll) {
            console.log('\n=== mirror-all: Scanning entire project for additional components ===');
            const globIgnore = [
                'node_modules/**',
                '.git/**',
                'dist/**',
                'build/**',
                '.expo/**',
                'coverage/**',
                'ios/**/build/**',
                'android/**/build/**',
                '.visual-clone/**',
            ];
            for (const folder of ignoreFolders) {
                const sanitized = folder.replace(/^\/+/, '');
                globIgnore.push(`${sanitized}/**`);
            }
            const additionalFiles = await (0, fast_glob_1.default)(['**/*.tsx', '**/*.jsx'], {
                cwd: options.projectRoot,
                ignore: globIgnore,
            });
            let addedCount = 0;
            for (const posixPath of additionalFiles) {
                const relativePath = posixPath;
                if (subtreeGraph.has(relativePath))
                    continue;
                const isIgnored = ignoreFolders.some((folder) => {
                    const normalizedFolder = folder.replace(/^\/+/, '');
                    return relativePath.startsWith(`${normalizedFolder}`);
                });
                if (isIgnored)
                    continue;
                subtreeGraph.set(relativePath, {
                    filePath: relativePath,
                    mode: 'mirror-strip',
                    imports: [],
                    jsxComponents: [],
                });
                addedCount += 1;
            }
            console.log(`mirror-all: added ${addedCount} additional mirrored components (total ${subtreeGraph.size})`);
        }
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
function literalExpressionFromKind(kind, options) {
    if (kind === 'number') {
        return { type: 'NumericLiteral', value: Number(options.numberDefault) };
    }
    if (kind === 'boolean') {
        return { type: 'BooleanLiteral', value: options.booleanDefault === true || options.booleanDefault === 'true' };
    }
    return { type: 'Identifier', name: '__preview_text' };
}
function inferExpressionKind(source) {
    const trimmed = source.trim();
    if (/^(true|false)$/.test(trimmed))
        return 'boolean';
    if (/^\d+(\.\d+)?$/.test(trimmed))
        return 'number';
    if (/(is|has|can|should|visible|disabled|open|highlighted|invisible|last)$/i.test(trimmed))
        return 'boolean';
    if (/(count|index|size|gap|length|total|page|offset|width|height)$/i.test(trimmed))
        return 'number';
    return 'text';
}
function inferAttributeKind(attributeName) {
    if (/^(disabled|visible|open|is[A-Z]|has[A-Z]|can[A-Z]|should[A-Z])/.test(attributeName))
        return 'boolean';
    if (/^(gap|index|numColumns|size|count|length|page|offset|width|height)$/.test(attributeName))
        return 'number';
    return 'text';
}
function isStaticExpression(node) {
    if (!node)
        return true;
    switch (node.type) {
        case 'StringLiteral':
        case 'NumericLiteral':
        case 'BooleanLiteral':
        case 'NullLiteral':
            return true;
        case 'TemplateLiteral':
            return node.expressions.length === 0;
        case 'ObjectExpression':
            return node.properties.every((property) => property.type === 'ObjectProperty' && isStaticExpression(property.value));
        case 'ArrayExpression':
            return node.elements.every((element) => !element || isStaticExpression(element));
        case 'UnaryExpression':
            return isStaticExpression(node.argument);
        default:
            return false;
    }
}
function sanitizeExpression(node, kind, options) {
    if (!node)
        return literalExpressionFromKind(kind, options);
    if (isStaticExpression(node))
        return node;
    if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
        return {
            type: 'ArrowFunctionExpression',
            id: null,
            generator: false,
            async: false,
            params: [],
            body: { type: 'BlockStatement', body: [], directives: [] },
        };
    }
    if (node.type === 'ObjectExpression') {
        return {
            ...node,
            properties: node.properties
                .filter((property) => property.type === 'ObjectProperty')
                .map((property) => ({
                ...property,
                value: sanitizeExpression(property.value, inferExpressionKind(property.key?.name ?? property.key?.value ?? ''), options),
            })),
        };
    }
    if (node.type === 'ArrayExpression') {
        return {
            ...node,
            elements: node.elements.map((element) => (element ? sanitizeExpression(element, kind, options) : element)),
        };
    }
    return literalExpressionFromKind(kind, options);
}
function cloneNode(node) {
    return JSON.parse(JSON.stringify(node));
}
function stripCommentsDeep(node) {
    if (!node || typeof node !== 'object')
        return node;
    delete node.comments;
    delete node.leadingComments;
    delete node.trailingComments;
    delete node.innerComments;
    for (const value of Object.values(node)) {
        if (Array.isArray(value)) {
            for (const item of value)
                stripCommentsDeep(item);
        }
        else if (value && typeof value === 'object') {
            stripCommentsDeep(value);
        }
    }
    return node;
}
function inferKindFromNode(node) {
    if (!node)
        return 'text';
    switch (node.type) {
        case 'BooleanLiteral':
            return 'boolean';
        case 'NumericLiteral':
            return 'number';
        case 'StringLiteral':
            return 'text';
        case 'Identifier':
            return inferExpressionKind(node.name ?? '');
        case 'MemberExpression':
            return inferExpressionKind(node.property?.name ?? node.property?.value ?? '');
        case 'UnaryExpression':
            if (node.operator === '!')
                return 'boolean';
            return inferKindFromNode(node.argument);
        case 'BinaryExpression':
        case 'LogicalExpression':
            if (['==', '===', '!=', '!==', '>', '<', '>=', '<='].includes(node.operator))
                return 'boolean';
            return inferKindFromNode(node.left);
        case 'ConditionalExpression':
            return inferKindFromNode(node.consequent);
        default:
            return 'text';
    }
}
function sanitizeJsxChildren(children, options) {
    const sanitizedChildren = [];
    for (const child of children ?? []) {
        if (!child)
            continue;
        if (child.type === 'JSXText') {
            sanitizedChildren.push(child);
            continue;
        }
        if (child.type === 'JSXElement' || child.type === 'JSXFragment') {
            const sanitized = sanitizeJsxNode(child, options);
            if (sanitized) {
                sanitizedChildren.push(sanitized);
            }
            continue;
        }
        if (child.type !== 'JSXExpressionContainer') {
            sanitizedChildren.push(child);
            continue;
        }
        const expression = child.expression;
        if (!expression || expression.type === 'JSXEmptyExpression')
            continue;
        if (expression.type === 'JSXElement' || expression.type === 'JSXFragment') {
            const sanitized = sanitizeJsxNode(expression, options);
            if (sanitized) {
                sanitizedChildren.push(sanitized);
            }
            continue;
        }
        if (expression.type === 'ConditionalExpression') {
            if (expression.consequent?.type === 'JSXElement' || expression.consequent?.type === 'JSXFragment') {
                const sanitized = sanitizeJsxNode(expression.consequent, options);
                if (sanitized) {
                    sanitizedChildren.push(sanitized);
                    continue;
                }
            }
            if (expression.alternate?.type === 'JSXElement' || expression.alternate?.type === 'JSXFragment') {
                const sanitized = sanitizeJsxNode(expression.alternate, options);
                if (sanitized) {
                    sanitizedChildren.push(sanitized);
                    continue;
                }
            }
            sanitizedChildren.push({
                ...child,
                expression: sanitizeExpression(expression.consequent, inferKindFromNode(expression.test), options),
            });
            continue;
        }
        if (expression.type === 'LogicalExpression') {
            if (expression.right?.type === 'JSXElement' || expression.right?.type === 'JSXFragment') {
                const sanitized = sanitizeJsxNode(expression.right, options);
                if (sanitized) {
                    sanitizedChildren.push(sanitized);
                    continue;
                }
            }
            sanitizedChildren.push({
                ...child,
                expression: sanitizeExpression(expression.right, inferKindFromNode(expression.left), options),
            });
            continue;
        }
        sanitizedChildren.push({
            ...child,
            expression: sanitizeExpression(expression, inferKindFromNode(expression), options),
        });
    }
    return sanitizedChildren;
}
function sanitizeJsxAttributes(attributes, options) {
    return (attributes ?? []).flatMap((attribute) => {
        if (!attribute)
            return [];
        if (attribute.type !== 'JSXAttribute')
            return [attribute];
        if (!attribute.value)
            return [attribute];
        const attributeName = attribute.name?.name;
        if (typeof attributeName !== 'string')
            return [attribute];
        if (['entering', 'exiting', 'layout', 'sharedTransitionTag'].includes(attributeName)) {
            return [];
        }
        if (attribute.value.type === 'StringLiteral')
            return [attribute];
        if (attribute.value.type !== 'JSXExpressionContainer')
            return [attribute];
        if (attribute.value.expression?.type === 'JSXEmptyExpression')
            return [];
        if (/^on[A-Z]/.test(attributeName) || /^set[A-Z]/.test(attributeName)) {
            return [{
                    ...attribute,
                    value: {
                        ...attribute.value,
                        expression: sanitizeExpression({ type: 'ArrowFunctionExpression', id: null, generator: false, async: false, params: [], body: { type: 'BlockStatement', body: [], directives: [] } }, 'text', options),
                    },
                }];
        }
        return [{
                ...attribute,
                value: {
                    ...attribute.value,
                    expression: sanitizeExpression(attribute.value.expression, inferAttributeKind(attributeName), options),
                },
            }];
    });
}
function sanitizeJsxNode(node, options) {
    if (!node)
        return node;
    if (node.type === 'JSXFragment') {
        return {
            ...node,
            children: sanitizeJsxChildren(node.children, options),
        };
    }
    if (node.type !== 'JSXElement')
        return node;
    if (shouldSkipJsxElement(node, options)) {
        return null;
    }
    return {
        ...node,
        openingElement: {
            ...node.openingElement,
            attributes: sanitizeJsxAttributes(node.openingElement.attributes, options),
        },
        children: sanitizeJsxChildren(node.children, options),
    };
}
function getJsxElementName(node) {
    if (!node)
        return null;
    if (node.type === 'JSXIdentifier') {
        return node.name ?? null;
    }
    if (node.type === 'JSXMemberExpression') {
        const objectName = getJsxElementName(node.object);
        const propertyName = node.property?.name ?? null;
        if (objectName && propertyName) {
            return `${objectName}.${propertyName}`;
        }
        return propertyName ?? objectName;
    }
    if (node.type === 'JSXNamespacedName') {
        const namespaceName = node.namespace?.name;
        const name = node.name?.name;
        if (namespaceName && name) {
            return `${namespaceName}:${name}`;
        }
        return name ?? namespaceName ?? null;
    }
    return null;
}
function shouldSkipJsxElement(node, options) {
    const skipSet = options?.skipComponentNameSet;
    if (!skipSet || skipSet.size === 0)
        return false;
    const elementName = getJsxElementName(node?.openingElement?.name);
    if (!elementName)
        return false;
    return skipSet.has(elementName);
}
function simplifyJsx(originalJsx, options, debugLabel) {
    const wrappedSource = `const __Preview = () => (${originalJsx});`;
    let ast;
    try {
        ast = (0, parser_1.parse)(wrappedSource, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx', 'classProperties'],
        });
    }
    catch (error) {
        throw new Error(`Failed to parse JSX for ${debugLabel}: ${error.message}`);
    }
    const declaration = ast.program.body[0].declarations[0];
    const sanitizedNode = sanitizeJsxNode(cloneNode(declaration.init.body), options) ?? createEmptyJsxFragment();
    const jsxNode = stripCommentsDeep(sanitizedNode);
    return (0, generator_1.default)(jsxNode).code;
}
function createEmptyJsxFragment() {
    return {
        type: 'JSXFragment',
        openingFragment: { type: 'JSXOpeningFragment' },
        closingFragment: { type: 'JSXClosingFragment' },
        children: [],
    };
}
function extractReturnedJsx(content, componentName) {
    try {
        const ast = (0, parser_1.parse)(content, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx', 'classProperties'],
        });
        let foundReturn = null;
        (0, traverse_1.default)(ast, {
            FunctionDeclaration(path) {
                if (foundReturn)
                    return;
                if (path.node.id?.name !== componentName)
                    return;
                path.traverse({
                    ReturnStatement(returnPath) {
                        if (!foundReturn && returnPath.node.argument) {
                            foundReturn = returnPath.node.argument;
                        }
                    },
                });
            },
            VariableDeclarator(path) {
                if (foundReturn)
                    return;
                if (path.node.id.type !== 'Identifier' || path.node.id.name !== componentName)
                    return;
                const init = path.node.init;
                if (!init || (init.type !== 'ArrowFunctionExpression' && init.type !== 'FunctionExpression'))
                    return;
                if (init.body.type === 'JSXElement' || init.body.type === 'JSXFragment') {
                    foundReturn = init.body;
                    return;
                }
                if (init.body.type === 'BlockStatement') {
                    for (const statement of init.body.body) {
                        if (statement.type === 'ReturnStatement' && statement.argument) {
                            foundReturn = statement.argument;
                            break;
                        }
                    }
                }
            },
        });
        if (foundReturn) {
            return (0, generator_1.default)(stripCommentsDeep(cloneNode(foundReturn))).code;
        }
    }
    catch {
        // fall back to regex below
    }
    const returnMatch = content.match(/return\s*\(([\s\S]*?)\);/);
    return returnMatch?.[1]?.trim() ?? '<></>';
}
function extractComponentName(content, fallbackName) {
    try {
        const ast = (0, parser_1.parse)(content, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx', 'classProperties'],
        });
        for (const node of ast.program.body) {
            if (node.type === 'ExportDefaultDeclaration') {
                const declaration = node.declaration;
                if (declaration?.type === 'FunctionDeclaration' && declaration.id?.name) {
                    return declaration.id.name;
                }
                if (declaration?.type === 'Identifier' && declaration.name) {
                    return declaration.name;
                }
            }
        }
        for (const node of ast.program.body) {
            if (node.type === 'FunctionDeclaration' && node.id?.name) {
                return node.id.name;
            }
            if (node.type === 'VariableDeclaration') {
                for (const declaration of node.declarations) {
                    if (declaration.id?.type === 'Identifier' && declaration.id.name) {
                        return declaration.id.name;
                    }
                }
            }
        }
    }
    catch {
        // fall back to regex below
    }
    const componentNameMatch = [
        /export\s+default\s+function\s+(\w+)\s*\(/,
        /const\s+(\w+)\s*=\s*\(/,
        /function\s+(\w+)\s*\(/,
    ].map((pattern) => content.match(pattern)).find(Boolean);
    return componentNameMatch?.[1] ?? fallbackName;
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
    const componentName = extractComponentName(content, path_1.default.basename(componentPath, path_1.default.extname(componentPath)));
    const originalJsx = extractReturnedJsx(content, componentName);
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
    let simplifiedJsx = simplifyJsx(originalJsx, options, componentPath);
    const importLines = transformedContent
        .split('\n')
        .map((line) => {
        if (!line.trim().startsWith('import'))
            return line;
        if (line.includes('hooks/'))
            return '';
        if (line.startsWith('import React,'))
            return "import React from 'react';";
        if (/import\s+\{[^}]+\}\s+from\s+['\"]types\//.test(line))
            return '';
        return line;
    })
        .filter((line) => line.trim().startsWith('import'));
    transformedContent = `${importLines.join('\n')}
${importLines.length ? '\n' : ''}${previewData}
type __PreviewProps = Record<string, unknown>;

const ${componentName} = (_props: __PreviewProps = {}) => {
  return (
${simplifiedJsx}
  );
};

export default ${componentName};
`;
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
