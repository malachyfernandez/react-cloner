"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = void 0;
exports.log = {
    info: (message, ...args) => {
        console.log(`[INFO] ${message}`, ...args);
    },
    success: (message, ...args) => {
        console.log(`[SUCCESS] ${message}`, ...args);
    },
    error: (message, ...args) => {
        console.error(`[ERROR] ${message}`, ...args);
    },
    warn: (message, ...args) => {
        console.warn(`[WARN] ${message}`, ...args);
    }
};
//# sourceMappingURL=log.js.map