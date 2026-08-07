import { useAuth } from "@clerk/clerk-expo";
import { Redirect, Tabs } from "expo-router";
import React from "react";
import { Text } from "react-native";
import { colors, fonts } from "@sendtally/design/tokens";

function TabLabel({ label, focused }: { label: string; focused: boolean }): React.ReactElement {
  return (
    <Text
      style={{
        fontFamily: fonts.monoMedium,
        fontSize: 10,
        letterSpacing: 1.2,
        color: focused ? colors.gunmetal : colors.textFaint,
      }}
    >
      {label}
    </Text>
  );
}

export default function TabsLayout(): React.ReactElement | null {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/sign-in" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surfaceSoft,
          borderTopColor: colors.lineOnLight,
          borderTopWidth: 1,
        },
        tabBarIconStyle: { display: "none" },
        tabBarLabelPosition: "beside-icon",
      }}
    >
      <Tabs.Screen
        name="sessions"
        options={{
          tabBarLabel: ({ focused }) => <TabLabel label="SESSIONS" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="trends"
        options={{
          tabBarLabel: ({ focused }) => <TabLabel label="TRENDS" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="sync"
        options={{
          tabBarLabel: ({ focused }) => <TabLabel label="SYNC" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
