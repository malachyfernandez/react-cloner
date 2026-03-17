"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.overwriteWithShell = overwriteWithShell;
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const prettier_1 = __importDefault(require("prettier"));
function toImportPath(fromFileAbs, toFileAbs) {
    const fromDir = path_1.default.dirname(fromFileAbs);
    let rel = path_1.default.relative(fromDir, toFileAbs);
    rel = rel.replace(/\.(tsx|ts|jsx|js)$/, "");
    if (!rel.startsWith("."))
        rel = `./${rel}`;
    return rel.split(path_1.default.sep).join("/");
}
async function overwriteWithShell(options) {
    const { outProjectRoot, baseFile, targetMirroredFile, shellType } = options;
    const baseFileAbs = path_1.default.resolve(outProjectRoot, baseFile);
    const targetMirroredAbs = path_1.default.resolve(outProjectRoot, targetMirroredFile);
    const previewImport = toImportPath(baseFileAbs, targetMirroredAbs);
    let source = "";
    if (shellType === "expo-router-safe-area" || shellType === "react-native-basic") {
        source = `
import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PreviewRoot from "${previewImport}";

export default function HomeScreen() {
  return (
    <View className="flex-1 bg-background">
      <SafeAreaView className="flex-1">
        <View className="w-full h-full items-center justify-center">
          <PreviewRoot />
        </View>
      </SafeAreaView>
    </View>
  );
}
`;
    }
    else {
        source = `
import React from "react";
import PreviewRoot from "${previewImport}";

export default function App() {
  return <PreviewRoot />;
}
`;
    }
    try {
        const config = await prettier_1.default.resolveConfig(baseFileAbs);
        const formatted = await prettier_1.default.format(source, {
            ...config,
            parser: "typescript",
        });
        await fs_extra_1.default.ensureDir(path_1.default.dirname(baseFileAbs));
        await fs_extra_1.default.writeFile(baseFileAbs, formatted, "utf8");
    }
    catch (error) {
        // If prettier fails (e.g., missing plugins), write unformatted
        console.warn('⚠️  Prettier formatting failed, writing unformatted:', error.message);
        await fs_extra_1.default.ensureDir(path_1.default.dirname(baseFileAbs));
        await fs_extra_1.default.writeFile(baseFileAbs, source, "utf8");
    }
}
