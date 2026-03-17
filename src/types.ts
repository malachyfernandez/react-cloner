export type PrimitiveKind = 'string' | 'number' | 'boolean' | 'null' | 'undefined' | 'unknown';

export type Shape =
  | { kind: PrimitiveKind }
  | { kind: 'array'; element: Shape }
  | { kind: 'object'; fields: Record<string, Shape> }
  | { kind: 'function'; params: Shape[]; returns: Shape }
  | { kind: 'reactNode' }
  | { kind: 'union'; options: Shape[] };

export type Framework = 'expo-router' | 'react-native' | 'react-web';

export type ComponentMode = 'mirror-strip' | 'opaque-real';

export interface ComponentNode {
  filePath: string;
  mode: ComponentMode;
  imports: string[];
  usedAsJsx: boolean;
}

export interface SubtreeGraph {
  nodes: Map<string, ComponentNode>;
  root: string;
  ignoredFolders: string[];
}

export interface CliOptions {
  projectRoot: string;
  baseFile: string;
  replaceComponent?: string;
  targetComponent: string;
  out: string;
  framework?: Framework;
  ignore?: string;
  mode: string;
  rootExport?: string;
  arrayLength: number;
  conditionals: boolean;
  stringDefault: string;
  numberDefault: number;
  booleanDefault: boolean;
  imagePlaceholder: string;
}

export interface Config {
  framework?: Framework;
  ignore?: string[];
  arrayLength?: number;
  conditionals?: boolean;
  stringDefault?: string;
  numberDefault?: number;
  booleanDefault?: boolean;
  imagePlaceholder?: string;
}

export interface PreviewBinding {
  name: string;
  shape: Shape;
  value: any;
}

export interface TransformContext {
  filePath: string;
  subtreeGraph: SubtreeGraph;
  options: CliOptions;
  previewBindings: Map<string, PreviewBinding>;
  importedComponents: Map<string, string>; // local name -> resolved path
}
