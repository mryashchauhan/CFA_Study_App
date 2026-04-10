import React from 'react';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { ClipboardList, Target } from 'lucide-react-native';
import { C } from '@/constants/theme';

export default function TabLayout() {
  const isWeb = Platform.OS === 'web';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.accentViolet,
        tabBarInactiveTintColor: C.textMuted,
        tabBarLabelPosition: 'below-icon',
        tabBarStyle: {
          backgroundColor: C.primaryBG,
          borderTopColor: 'rgba(255, 255, 255, 0.08)',
          borderTopWidth: 1.5,
          height: isWeb ? 104 : 96,
          paddingTop: 10,
          paddingBottom: isWeb ? 32 : 24,
        },
        tabBarItemStyle: {
          minHeight: 58,
          paddingVertical: 6,
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarIconStyle: {
          marginTop: 2,
          marginBottom: 4,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          marginBottom: isWeb ? 2 : 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Planner',
          tabBarIcon: ({ color }) => <ClipboardList size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="focus"
        options={{
          title: 'Focus',
          tabBarIcon: ({ color }) => <Target size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
