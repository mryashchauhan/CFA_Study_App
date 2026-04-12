import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { C } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * google-auth Landing Pad
 * Dedicated route for deep-linking redirects during OAuth.
 * This prevents the "This screen doesn't exist" error.
 */
export default function GoogleAuthLanding() {
  const router = useRouter();
  const { authReady, userEmail } = useTimer();

  useEffect(() => {
    // Wait for the background handshake to complete definitively
    if (authReady && userEmail) {
      const timer = setTimeout(() => {
        router.replace('/(tabs)');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [authReady, userEmail]);

  return (
    <View style={s.container}>
      <LinearGradient colors={['#02040C', '#0A0C16']} style={StyleSheet.absoluteFill} />
      <View style={s.content}>
        <ActivityIndicator size="large" color={C.accentCyan} />
        <Text style={s.title}>Finalizing Login...</Text>
        <Text style={s.subtitle}>Syncing your CFA study history</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#02040C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 16,
  },
  title: {
    color: C.white,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
  }
});
