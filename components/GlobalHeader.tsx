import React from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { RefreshCcw, Check, Zap } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, R, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTimer } from '@/lib/TimerContext';

/**
 * GlobalCommandHeader
 * Anchored at the top of the app in TabLayout.
 * Provides consistent visibility for Auth and Sync controls.
 */
export function GlobalCommandHeader() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { userEmail, signInWithGoogle, handleSync, forceMerge } = useTimer();
  const isDesktop = width >= 1024;
  const isMobile = width < 768;

  const handleAuthPress = () => {
    if (userEmail) {
      forceMerge();
    } else {
      signInWithGoogle();
    }
  };

  return (
    <View style={[s.globalHeader, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={[s.content, { maxWidth: 1200, alignSelf: 'center', width: '100%', paddingHorizontal: isMobile ? 12 : 24 }]}>
        <View style={s.row}>
          {/* Branded Title */}
          <View style={s.brand}>
            <Zap size={20} color={C.accentCyan} />
            <Text style={s.brandTxt}>R1</Text>
          </View>

          {/* Controls */}
          <View style={s.controls}>
            {/* 1. Magic Link */}
            <Pressable 
              onPress={handleSync}
              style={({ pressed }) => [s.btn, s.btnMagic, pressed && { opacity: 0.7 }]}
            >
              <RefreshCcw size={14} color={C.accentCyan} />
              <Text style={s.btnTxt}>MAGIC LINK</Text>
            </Pressable>

            {/* 2. Google Login / Badge */}
            <Pressable 
              onPress={handleAuthPress}
              style={({ pressed }) => [
                s.btn, 
                userEmail ? s.btnProfile : s.btnGoogle, 
                pressed && { opacity: 0.7 }
              ]}
            >
              {userEmail ? (
                <>
                  <Check size={14} color={C.accentCyan} />
                  <Text style={[s.btnTxt, s.profileTxt]} numberOfLines={1}>
                    SYNCED: {userEmail}
                  </Text>
                </>
              ) : (
                <>
                  <RefreshCcw size={14} color="#fff" />
                  <Text style={[s.btnTxt, { color: '#fff' }]}>SYNC GOOGLE</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  globalHeader: {
    backgroundColor: C.primaryBG,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 12,
    zIndex: 100,
  },
  content: {
    flexDirection: 'column',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandTxt: {
    color: C.white,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: R.xs,
    borderWidth: 1,
  },
  btnMagic: {
    backgroundColor: 'rgba(34, 211, 238, 0.05)',
    borderColor: 'rgba(34, 211, 238, 0.1)',
  },
  btnGoogle: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  btnProfile: {
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderColor: 'rgba(6, 182, 212, 0.3)',
    maxWidth: 200,
    borderRadius: 20,
  },
  btnTxt: {
    fontSize: 10,
    fontWeight: '800',
    color: C.accentCyan,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  profileTxt: {
    color: C.white,
    textTransform: 'none',
  }
});
