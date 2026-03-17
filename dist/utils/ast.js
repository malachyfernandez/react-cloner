"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFile = parseFile;
const parser_1 = require("@babel/parser");
const fs_extra_1 = __importDefault(require("fs-extra"));
async function parseFile(filePath) {
    const content = await fs_extra_1.default.readFile(filePath, 'utf-8');
    return (0, parser_1.parse)(content, {
        sourceType: 'module',
        plugins: [
            'typescript',
            'jsx',
            'classProperties',
            'decorators-legacy',
            'dynamicImport'
        ]
    });
}
//# sourceMappingURL=ast.js.map