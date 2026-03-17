"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
async function loadConfig(projectRoot) {
    const configPath = path_1.default.join(projectRoot, '.react-visual-clonerc.json');
    if (await fs_extra_1.default.pathExists(configPath)) {
        try {
            const configContent = await fs_extra_1.default.readFile(configPath, 'utf-8');
            return JSON.parse(configContent);
        }
        catch (error) {
            console.warn(`Failed to load config file at ${configPath}:`, error);
            return {};
        }
    }
    return {};
}
//# sourceMappingURL=config.js.map