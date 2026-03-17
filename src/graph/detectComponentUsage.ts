import { parseFile } from '../utils/ast';
import { ImportDeclaration } from '@babel/types';
import { ComponentNode, ComponentMode } from '../types';

export async function detectComponentUsage(filePath: string): Promise<{
  imports: Map<string, string>; // local name -> import path
  jsxComponents: Set<string>;   // local names used as JSX components
}> {
  const ast = await parseFile(filePath);
  const imports = new Map<string, string>();
  const jsxComponents = new Set<string>();
  
  // Collect imports
  for (const node of ast.program.body) {
    if (node.type === 'ImportDeclaration') {
      const importDecl = node as ImportDeclaration;
      for (const specifier of importDecl.specifiers) {
        if (specifier.type === 'ImportDefaultSpecifier' ||
            specifier.type === 'ImportSpecifier') {
          imports.set(specifier.local.name, (importDecl.source.value as string));
        }
      }
    }
  }
  
  // Find JSX component usage
  const traverse = require('@babel/traverse').default;
  traverse(ast, {
    JSXElement(path: any) {
      const openingElement = path.node.openingElement;
      const componentName = openingElement.name.name;
      if (typeof componentName === 'string' && imports.has(componentName)) {
        jsxComponents.add(componentName);
      }
    },
    JSXFragment(path: any) {
      // Fragments are not external components
    }
  });
  
  return { imports, jsxComponents };
}
