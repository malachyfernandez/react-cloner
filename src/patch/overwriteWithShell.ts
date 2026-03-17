import path from "path";
import fs from "fs-extra";
import prettier from "prettier";

export interface OverwriteShellOptions {
  outProjectRoot: string;
  baseFile: string;
  targetMirroredFile: string;
  shellType: "expo-router-safe-area" | "react-native-basic" | "react-web-basic";
}

function toImportPath(fromFileAbs: string, toFileAbs: string): string {
  const fromDir = path.dirname(fromFileAbs);
  let rel = path.relative(fromDir, toFileAbs);
  rel = rel.replace(/\.(tsx|ts|jsx|js)$/, "");
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return rel.split(path.sep).join("/");
}

export async function overwriteWithShell(
  options: OverwriteShellOptions
): Promise<void> {
  const { outProjectRoot, baseFile, targetMirroredFile, shellType } = options;

  const baseFileAbs = path.resolve(outProjectRoot, baseFile);
  const targetMirroredAbs = path.resolve(outProjectRoot, targetMirroredFile);
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
  } else {
    source = `
import React from "react";
import PreviewRoot from "${previewImport}";

export default function App() {
  return <PreviewRoot />;
}
`;
  }

  try {
    const config = await prettier.resolveConfig(baseFileAbs);
    const formatted = await prettier.format(source, {
      ...config,
      parser: "typescript",
    });
    await fs.ensureDir(path.dirname(baseFileAbs));
    await fs.writeFile(baseFileAbs, formatted, "utf8");
  } catch (error) {
    // If prettier fails (e.g., missing plugins), write unformatted
    console.warn('⚠️  Prettier formatting failed, writing unformatted:', error.message);
    await fs.ensureDir(path.dirname(baseFileAbs));
    await fs.writeFile(baseFileAbs, source, "utf8");
  }
}
