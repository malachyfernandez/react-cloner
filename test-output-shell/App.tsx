import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PreviewRoot from ".visual-clone/mirrored/components/JoinedGames";

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
