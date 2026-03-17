export const VISUAL_CLONE_DIR = '.visual-clone';
export const MIRRORED_DIR = 'mirrored';
export const RUNTIME_FILE = 'runtime.ts';

export const DEFAULT_IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.expo',
  'coverage',
  'ios/build',
  'android/build',
  '.next',
  '.nuxt',
  '.output',
  '.vercel'
];

export const JS_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];
export const COMPONENT_EXTENSIONS = ['.tsx', '.jsx'];

export const HOOK_NAMES = [
  'useState',
  'useEffect',
  'useMemo',
  'useCallback',
  'useRef',
  'useReducer',
  'useContext',
  'useLayoutEffect',
  'useImperativeHandle',
  'useSyncExternalStore',
  'useTransition',
  'useDeferredValue',
  'useId'
];

export const HANDLER_PROP_PATTERNS = [
  /^on[A-Z]/,
  /^set[A-Z]/,
  /^handle[A-Z]/
];

export const VISUAL_PLACEHOLDERS = {
  string: 'Lorem ipsum',
  number: 1,
  boolean: true,
  image: { uri: 'https://via.placeholder.com/300x200' },
  noop: () => {}
};
