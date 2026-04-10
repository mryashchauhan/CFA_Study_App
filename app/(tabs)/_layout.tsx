import React from 'react';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { ClipboardList, Target } from 'lucide-react-native';
import { C } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.accentTeal,
        tabBarInactiveTintColor: C.textMuted,
        tabBarStyle: {
          backgroundColor: C.primaryBG,
          borderTopColor: C.border,
          borderTopWidth: 1,
          height: Platform.OS === 'web' ? 64 : 88,
          paddingBottom: Platform.OS === 'web' ? 8 : 28,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Planner',
          tabBarIcon: ({ color, size }) => (
            <ClipboardList size={size ?? 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="focus"
        options={{
          title: 'Focus',
          tabBarIcon: ({ color, size }) => (
            <Target size={size ?? 22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
