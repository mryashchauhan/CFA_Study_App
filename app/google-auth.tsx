import { C } from '@/constants/theme';
import { supabase } from '@/lib/supabaseClient';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, TouchableOpacity } from 'react-native';

export default function GoogleAuthLanding() {
  const router = useRouter();
  const initialUrl = Linking.useURL(); 
  const [debugLog, setDebugLog] = useState('Waiting for secure redirect...');
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!initialUrl) return;
    if (handledRef.current === initialUrl) return;
    handledRef.current = initialUrl; // LOCK IMMEDIATELY before any async work

    const processAuth = async () => {
      try {
        setDebugLog('URL intercepted. Parsing tokens...');

        // Manual Parsing (Bypass Linking.parse for PKCE/fragment safety)
        const tokenStr = initialUrl.includes('#') ? initialUrl.split('#')[1] : initialUrl.split('?')[1] || '';
        const params = new URLSearchParams(tokenStr);
        const code = params.get('code');
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');

        // 1. Handshake
        if (code) {
          setDebugLog('Authenticating with secure code...');
          await supabase.auth.exchangeCodeForSession(code);
        } else if (access_token && refresh_token) {
          setDebugLog('Restoring active session...');
          await supabase.auth.setSession({ access_token, refresh_token });
        } else {
          setDebugLog('No tokens found. Bypassing to Guest Mode.');
        }

        // 2. VERIFY (The Absolute Requirement)
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session?.user?.id) {
          throw new Error("Session initialization failed at the gate");
        }

        console.log('✅ Handshake Verified. User ID:', data.session.user.id);
        router.replace('/(tabs)');
      } catch (e: any) {
        setDebugLog(`❌ Auth Error: ${e.message}`);
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
