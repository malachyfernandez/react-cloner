"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectFramework = detectFramework;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const log_1 = require("../utils/log");
async function detectFramework(projectRoot) {
    log_1.log.info('Detecting framework...');
    // Check for Expo Router
    const appLayoutPath = path_1.default.join(projectRoot, 'app', '_layout.tsx');
    if (await fs_extra_1.default.pathExists(appLayoutPath)) {
        log_1.log.info('Detected framework: expo-router');
        return 'expo-router';
    }
    // Check for React Native
    const appTsxPath = path_1.default.join(projectRoot, 'App.tsx');
    if (await fs_extra_1.default.pathExists(appTsxPath)) {
        log_1.log.info('Detected framework: react-native');
        return 'react-native';
    }
    // Check for React Web
    const srcAppPath = path_1.default.join(projectRoot, 'src', 'App.tsx');
    if (await fs_extra_1.default.pathExists(srcAppPath)) {
        log_1.log.info('Detected framework: react-web');
        return 'react-web';
    }
    // Fallback - try to guess based on package.json
    const packageJsonPath = path_1.default.join(projectRoot, 'package.json');
    if (await fs_extra_1.default.pathExists(packageJsonPath)) {
        const packageJson = await fs_extra_1.default.readJson(packageJsonPath);
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        if (deps['expo'] || deps['expo-router']) {
            log_1.log.info('Detected framework: expo-router (from package.json)');
            return 'expo-router';
        }
        if (deps['react-native']) {
            log_1.log.info('Detected framework: react-native (from package.json)');
            return 'react-native';
        }
    }
    log_1.log.warn('Could not detect framework, defaulting to react-web');
    return 'react-web';
}
//# sourceMappingURL=detectFramework.js.map