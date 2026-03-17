"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.copyProject = copyProject;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const fast_glob_1 = __importDefault(require("fast-glob"));
const constants_1 = require("../utils/constants");
const log_1 = require("../utils/log");
async function copyProject(projectRoot, outputPath, additionalIgnorePatterns = []) {
    log_1.log.info(`Copying project from ${projectRoot} to ${outputPath}`);
    // Ensure output directory doesn't exist or is empty
    if (await fs_extra_1.default.pathExists(outputPath)) {
        await fs_extra_1.default.remove(outputPath);
    }
    await fs_extra_1.default.ensureDir(outputPath);
    // Combine default ignore patterns with user-provided ones
    const ignorePatterns = [
        ...constants_1.DEFAULT_IGNORE_PATTERNS,
        ...additionalIgnorePatterns
    ];
    // Create glob patterns for ignoring
    const ignoreGlobPatterns = ignorePatterns.map(pattern => `**/${pattern}`);
    try {
        // Get all files to copy (excluding ignored patterns)
        const entries = await (0, fast_glob_1.default)('**/*', {
            cwd: projectRoot,
            dot: true,
            onlyFiles: false,
            ignore: ignoreGlobPatterns
        });
        log_1.log.info(`Found ${entries.length} entries to copy`);
        // Copy each entry
        for (const entry of entries) {
            const srcPath = path_1.default.join(projectRoot, entry);
            const destPath = path_1.default.join(outputPath, entry);
            // Ensure parent directory exists
            await fs_extra_1.default.ensureDir(path_1.default.dirname(destPath));
            // Copy the entry (preserving file/directory structure)
            await fs_extra_1.default.copy(srcPath, destPath);
        }
        log_1.log.success(`Project copied successfully to ${outputPath}`);
    }
    catch (error) {
        log_1.log.error('Failed to copy project:', error);
        throw error;
    }
}
//# sourceMappingURL=copyProject.js.map