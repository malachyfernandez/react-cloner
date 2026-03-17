"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VISUAL_PLACEHOLDERS = exports.HANDLER_PROP_PATTERNS = exports.HOOK_NAMES = exports.COMPONENT_EXTENSIONS = exports.JS_EXTENSIONS = exports.DEFAULT_IGNORE_PATTERNS = exports.RUNTIME_FILE = exports.MIRRORED_DIR = exports.VISUAL_CLONE_DIR = void 0;
exports.VISUAL_CLONE_DIR = '.visual-clone';
exports.MIRRORED_DIR = 'mirrored';
exports.RUNTIME_FILE = 'runtime.ts';
exports.DEFAULT_IGNORE_PATTERNS = [
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
exports.JS_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];
exports.COMPONENT_EXTENSIONS = ['.tsx', '.jsx'];
exports.HOOK_NAMES = [
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
exports.HANDLER_PROP_PATTERNS = [
    /^on[A-Z]/,
    /^set[A-Z]/,
    /^handle[A-Z]/
];
exports.VISUAL_PLACEHOLDERS = {
    string: 'Lorem ipsum',
    number: 1,
    boolean: true,
    image: { uri: 'https://via.placeholder.com/300x200' },
    noop: () => { }
};
//# sourceMappingURL=constants.js.map