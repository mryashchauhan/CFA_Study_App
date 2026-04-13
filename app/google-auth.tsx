import { C } from '@/constants/theme';
import { supabase } from '@/lib/supabaseClient';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, TouchableOpacity } from 'react-native';

export default function GoogleAuthLanding() {
  const router = useRouter();
  const initialUrl = Linking.useURL(); 
  const [debugLog, setDebugLog] = useState('Waiting for secure redirect...');

  useEffect(() => {
    if (!initialUrl) return;

    const processAuth = async () => {
      try {
        setDebugLog('URL intercepted. Parsing tokens...');

        const fragmentStr = initialUrl.split('#')[1] ?? '';
        const fragment = Object.fromEntries(new URLSearchParams(fragmentStr));

        const parsed = Linking.parse(initialUrl);
        const code = parsed.queryParams?.code as string;
        const access_token = (parsed.queryParams?.access_token ?? fragment.access_token) as string;
        const refresh_token = (parsed.queryParams?.refresh_token ?? fragment.refresh_token) as string;

        if (code) {
          setDebugLog('Authenticating with secure code...');
          await supabase.auth.exchangeCodeForSession(code);
        } else if (access_token && refresh_token) {
          setDebugLog('Restoring active session...');
          await supabase.auth.setSession({ access_token, refresh_token });
        } else {
          setDebugLog('No tokens found. Bypassing to Guest Mode.');
        }

        router.replace('/(tabs)');
      } catch (e: any) {
        setDebugLog(`Auth Error: ${e.message}`);
        setTimeout(() => router.replace('/(tabs)'), 2000);
      }
    };

    processAuth();
  }, [initialUrl, router]);

  // Fallback timeout just in case it hangs
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebugLog('Handshake timeout. Tap below to continue.');
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={s.container}>
      <LinearGradient colors={['#02040C', '#0A0C16']} style={StyleSheet.absoluteFill} />
      <View style={s.content}>
        <ActivityIndicator size="large" color={C.accentCyan} />
        <Text style={s.title}>Finalizing Login...</Text>
        <Text style={s.subtitle}>Syncing your CFA study history</Text>
        
        <Text style={s.debug}>{debugLog}</Text>

        <TouchableOpacity style={s.button} onPress={() => router.replace('/(tabs)')}>
          <Text style={s.buttonText}>Force Continue to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#02040C', alignItems: 'center', justifyContent: 'center' },
  content: { alignItems: 'center', gap: 16, padding: 20 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 8 },
  subtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 15 },
  debug: { color: '#FFD700', fontSize: 13, marginTop: 24, textAlign: 'center', paddingHorizontal: 20 },
  button: { marginTop: 40, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' }
});
