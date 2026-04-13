import { C } from '@/constants/theme';
import { supabase } from '@/lib/supabaseClient';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function GoogleAuthLanding() {
  const router = useRouter();

  useEffect(() => {
    const handleUrl = async (url: string) => {
      try {
        // Handle fragment-based tokens (implicit flow)
        const fragmentStr = url.split('#')[1] ?? '';
        const fragment = Object.fromEntries(new URLSearchParams(fragmentStr));
        
        const parsed = Linking.parse(url);
        const code = parsed.queryParams?.code as string;
        const access_token = (parsed.queryParams?.access_token ?? fragment.access_token) as string;
        const refresh_token = (parsed.queryParams?.refresh_token ?? fragment.refresh_token) as string;
        
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        } else if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
        }
        
        router.replace('/(tabs)');
      } catch (e) {
        console.log('OAuth error:', e);
        router.replace('/(tabs)');
      }
    };

    Linking.getInitialURL().then(url => { 
      if (url) handleUrl(url); 
    });

    const sub = Linking.addEventListener('url', e => handleUrl(e.url));
    
    return () => sub.remove();
  }, [router]);

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
  container: { flex: 1, backgroundColor: '#02040C', alignItems: 'center', justifyContent: 'center' },
  content: { alignItems: 'center', gap: 16 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 8 },
  subtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 15 },
});
