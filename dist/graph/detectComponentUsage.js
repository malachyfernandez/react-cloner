"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectComponentUsage = detectComponentUsage;
const ast_1 = require("../utils/ast");
async function detectComponentUsage(filePath) {
    const ast = await (0, ast_1.parseFile)(filePath);
    const imports = new Map();
    const jsxComponents = new Set();
    // Collect imports
    for (const node of ast.program.body) {
        if (node.type === 'ImportDeclaration') {
            const importDecl = node;
            for (const specifier of importDecl.specifiers) {
                if (specifier.type === 'ImportDefaultSpecifier' ||
                    specifier.type === 'ImportSpecifier') {
                    imports.set(specifier.local.name, importDecl.source.value);
                }
            }
        }
    }
    // Find JSX component usage
    const traverse = require('@babel/traverse').default;
    traverse(ast, {
        JSXElement(path) {
            const openingElement = path.node.openingElement;
            const componentName = openingElement.name.name;
            if (typeof componentName === 'string' && imports.has(componentName)) {
                jsxComponents.add(componentName);
            }
        },
        JSXFragment(path) {
            // Fragments are not external components
        }
    });
    return { imports, jsxComponents };
}
//# sourceMappingURL=detectComponentUsage.js.map