"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveImport = resolveImport;
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const constants_1 = require("../utils/constants");
async function resolveImport(importPath, fromFile, projectRoot) {
    // Handle package imports (node_modules)
    if (!importPath.startsWith('.')) {
        return null; // Package import - don't resolve for subtree graph
    }
    const fromDir = path_1.default.dirname(fromFile);
    let resolvedPath = path_1.default.resolve(fromDir, importPath);
    // Try different extensions
    for (const ext of constants_1.JS_EXTENSIONS) {
        const candidatePath = resolvedPath + ext;
        if (await fs_extra_1.default.pathExists(candidatePath)) {
            return path_1.default.relative(projectRoot, candidatePath);
        }
    }
    // Try index files
    for (const ext of constants_1.JS_EXTENSIONS) {
        const indexPath = path_1.default.join(resolvedPath, `index${ext}`);
        if (await fs_extra_1.default.pathExists(indexPath)) {
            return path_1.default.relative(projectRoot, indexPath);
        }
    }
    return null; // Could not resolve
}
//# sourceMappingURL=resolveImport.js.map