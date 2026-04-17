import React, { useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Play, Pause, RotateCcw, Target, CheckCircle2, Award } from 'lucide-react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { useTimer } from '@/lib/TimerContext';
import {
  C,
  R,
  SPACING,
  TYPOGRAPHY,
  SHADOWS,
  GRADIENTS,
  SYLLABUS,
  EXAM_LIST,
  RATIOS,
  pretty,
} from '@/constants/theme';

const PRESET_LABELS: Record<number, string> = { 1: 'Demo', 15: 'Sprint', 25: 'Classic', 52: 'Ultradian', 90: 'Deep work' };

export default function FocusScreen() {
  const { width } = useWindowDimensions();
  const navigation = useNavigation();
  const {
    timeLeft,
    authReady,
    isActive,
    isFinished,
    ratio,
    exam,
    section,
    topic,
    strictMode,
    recallText,
    attemptedThisSession,
    correctThisSession,
    setRatio,
    setExam,
    setSection,
    setTopic,
    setStrictMode,
    setRecallText,
    setAttempted,
    setCorrect,
    startTimer,
    pauseTimer,
    resetTimer,
    submitRecall,
  } = useTimer();

  // Surgical Tab-Hiding Logic
  useLayoutEffect(() => {
    const parent = navigation.getParent();
    if (parent) {
      parent.setOptions({ 
        tabBarStyle: isActive ? { display: 'none', height: 0 } : {
          backgroundColor: C.primaryBG,
          borderTopColor: 'rgba(255, 255, 255, 0.08)',
          borderTopWidth: 1.5,
          height: Platform.OS === 'web' ? 104 : 96,
          paddingTop: 10,
          paddingBottom: Platform.OS === 'web' ? 32 : 24,
          alignSelf: 'center',
          width: '100%',
        }
      });
    }
    
    // Also set locally for single-screen router behavior
    navigation.setOptions({
      tabBarStyle: isActive ? { display: 'none' } : undefined
    });
  }, [navigation, isActive]);

  const isDesktop = width >= 768;
  const TIMER_SIZE = isDesktop ? 340 : 270;
  const STROKE_WIDTH = isDesktop ? 6 : 5;
  const RADIUS = (TIMER_SIZE - 20) / 2;
  const CIRCUMF = 2 * Math.PI * RADIUS;
  const totalSeconds = Math.max(1, ratio * 60);
  const progress = Math.max(0, Math.min(1, timeLeft / totalSeconds));
  const strokeDashoffset = CIRCUMF - progress * CIRCUMF;

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const ss = String(timeLeft % 60).padStart(2, '0');
  const timerStyle = isDesktop ? TYPOGRAPHY.heroTimerTablet : TYPOGRAPHY.heroTimerMobile;
  const phaseLabel = isActive ? 'FOCUS' : isFinished ? 'COMPLETE' : 'READY';

  if (!authReady) {
    return (
      <View style={[s.center, { backgroundColor: C.primaryBG }]}>
        <ActivityIndicator size="large" color={C.accentCyan} />
      </View>
    );
  }

  if (isFinished) {
    return (
      <View style={[s.root, { backgroundColor: C.primaryBG }]}>
        {/* No gradient for pure AMOLED depth */}
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={s.recallWrap} keyboardShouldPersistTaps="handled">
            <View style={[s.card, SHADOWS.shadowGlass, { padding: 32, backgroundColor: '#05070A' }]}>
              <View style={{ alignItems: 'center', marginBottom: 24 }}>
                 <Award size={48} color={C.accentCyan} />
                 <Text style={[s.recallTitle, { marginTop: 12 }]}>Session Complete</Text>
                 <Text style={[TYPOGRAPHY.body, { opacity: 0.6, textAlign: 'center' }]}>
                   Diagnostics & Retention Review
                 </Text>
              </View>

              <View style={s.inputGroup}>
                <Text style={s.inputLabel}>Reflections & Notes</Text>
                <TextInput
                  value={recallText}
                  onChangeText={setRecallText}
                  placeholder="What did you learn? Any distractions?"
                  placeholderTextColor={C.textMuted}
                  multiline
                  autoFocus
                  style={s.recallInput}
                />
              </View>

              <View style={s.perfRow}>
                 <View style={s.perfCol}>
                    <Text style={s.inputLabel}>Attempted</Text>
                    <View style={s.numericWrap}>
                       <Target size={18} color={C.textMuted} style={{ marginRight: 8 }} />
                       <TextInput
                          value={attemptedThisSession}
                          onChangeText={setAttempted}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={C.textMuted}
                          style={s.numericInput}
                       />
                    </View>
                 </View>
                 <View style={s.perfCol}>
                    <Text style={s.inputLabel}>Correct</Text>
                     <View style={[
                       s.numericWrap, 
                       parseInt(correctThisSession) > parseInt(attemptedThisSession) && { borderColor: C.accentRed, borderWidth: 1.5 }
                     ]}>
                       <CheckCircle2 size={18} color={parseInt(correctThisSession) > parseInt(attemptedThisSession) ? C.accentRed : C.success} style={{ marginRight: 8 }} />
                       <TextInput
                          value={correctThisSession}
                          onChangeText={setCorrect}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={C.textMuted}
                          style={s.numericInput}
                       />
                    </View>
                 </View>
              </View>

              <Pressable 
                onPress={submitRecall} 
                style={({ pressed }) => [s.bigBtnWrap, { marginTop: 32 }, pressed && { opacity: 0.85 }]}
              >
                <LinearGradient
                  colors={GRADIENTS.cta}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.bigBtn}
                >
                  <Text style={TYPOGRAPHY.buttonText}>Log Session Performance</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <View style={[s.root, isActive && { backgroundColor: '#000000' }]}>
      {!isActive && <LinearGradient colors={[C.primaryBG, C.secondaryBG]} style={StyleSheet.absoluteFillObject} />}
      
      {/* Background Atmosphere - Only show when NOT active */}
      {!isActive && (
        <>
          <View style={[s.blob, s.blob1, { opacity: 0.08, backgroundColor: C.accentCyan }]} />
          <View style={[s.blob, s.blob2, { opacity: 0.06, backgroundColor: C.accentIndigo }]} />
        </>
      )}

      {isActive ? (
        // SURGICAL ZEN MODE UI
        <View style={s.zenFull}>
          <View style={s.timerWrapZen}>
             <Svg width={TIMER_SIZE} height={TIMER_SIZE} style={s.timerSvg}>
                <Defs>
                  <SvgLinearGradient id="timerProgress" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor={GRADIENTS.timerRing[0]} />
                    <Stop offset="100%" stopColor={GRADIENTS.timerRing[1]} />
                  </SvgLinearGradient>
                </Defs>
                <Circle cx={TIMER_SIZE/2} cy={TIMER_SIZE/2} r={RADIUS} stroke="rgba(255,255,255,0.02)" strokeWidth={STROKE_WIDTH} fill="transparent" />
                <Circle cx={TIMER_SIZE/2} cy={TIMER_SIZE/2} r={RADIUS} stroke="url(#timerProgress)" strokeWidth={STROKE_WIDTH} strokeDasharray={CIRCUMF} strokeDashoffset={strokeDashoffset} strokeLinecap="round" fill="transparent" rotation="-90" origin={`${TIMER_SIZE/2}, ${TIMER_SIZE/2}`} />
             </Svg>
              <Text style={[timerStyle, { color: C.white, fontVariant: ['tabular-nums'] }]}>{mm}:{ss}</Text>
          </View>
          <Pressable onPress={pauseTimer} style={s.zenPauseBtn}>
             <Pause size={18} color={C.textMuted} />
             <Text style={s.zenPauseTxt}>PAUSE SESSION</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            s.scrollInner,
            { paddingHorizontal: isDesktop ? SPACING.xxxl : SPACING.lg },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Session Pips */}
          <View style={s.pipsRow}>
            {[1,2,3,4].map(i => (
              <View key={i} style={[s.pip, i === 1 && s.pipActive]} />
            ))}
            <Text style={s.pipLabel}>SESSION 1 OF 4</Text>
          </View>

          <View style={s.pathBadge}>
            <Text 
              style={s.pathTxt} 
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {exam}  ›  {pretty(section)}  ›  {topic}
            </Text>
          </View>

          <View style={s.heroBlock}>
            <View
              style={[
                s.heroAura,
                {
                  width: TIMER_SIZE + 40,
                  height: TIMER_SIZE + 40,
                  borderRadius: (TIMER_SIZE + 40) / 2,
                  backgroundColor: 'rgba(34, 211, 238, 0.025)',
                  borderWidth: 2,
                  borderColor: 'rgba(34, 211, 238, 0.05)',
                },
              ]}
            />

            <View
              style={[
                s.timerWrap,
                {
                  width: TIMER_SIZE,
                  height: TIMER_SIZE,
                  borderRadius: TIMER_SIZE / 2,
                },
              ]}
            >
              <Svg width={TIMER_SIZE} height={TIMER_SIZE} style={s.timerSvg}>
                <Defs>
                  <SvgLinearGradient id="timerProgress" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor={GRADIENTS.timerRing[0]} />
                    <Stop offset="100%" stopColor={GRADIENTS.timerRing[1]} />
                  </SvgLinearGradient>
                </Defs>

                <Circle
                  cx={TIMER_SIZE / 2}
                  cy={TIMER_SIZE / 2}
                  r={RADIUS}
                  stroke="rgba(255,255,255,0.03)"
                  strokeWidth={STROKE_WIDTH}
                  fill="transparent"
                />
                <Circle
                  cx={TIMER_SIZE / 2}
                  cy={TIMER_SIZE / 2}
                  r={RADIUS}
                  stroke="url(#timerProgress)"
                  strokeWidth={STROKE_WIDTH}
                  strokeDasharray={CIRCUMF}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  rotation="-90"
                  origin={`${TIMER_SIZE / 2}, ${TIMER_SIZE / 2}`}
                />
              </Svg>

              <LinearGradient
                colors={['rgba(255,255,255,0.01)', 'rgba(255,255,255,0.03)']}
                style={[
                  s.timerContent,
                  {
                    width:    TIMER_SIZE - 20,
                    height:   TIMER_SIZE - 20,
                    borderRadius: (TIMER_SIZE - 20) / 2,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.05)',
                  },
                ]}
              >
                <View style={s.timerHighlight} />
                <Text style={s.phaseLabelTxt}>{phaseLabel}</Text>
                <Text 
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={[timerStyle, { color: C.textPrimary, fontVariant: ['tabular-nums'] }]}
                >
                  {mm}:{ss}
                </Text>
                <Text style={s.tapHint}>Tap play to begin</Text>
              </LinearGradient>
            </View>

            <View style={s.controlsRow}>
              <Pressable
                onPress={isActive ? pauseTimer : startTimer}
                style={({ pressed }) => [s.mainActionWrap, pressed && { opacity: 0.9 }]}
              >
                <LinearGradient
                  colors={GRADIENTS.cta}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0.5 }}
                  style={s.mainActionGradient}
                >
                  {isActive ? (
                    <Pause size={24} color={C.white} />
                  ) : (
                    <Play size={24} color={C.white} fill={C.white} />
                  )}
                  <Text style={s.mainActionTxt}>{isActive ? 'PAUSE' : 'DEEP WORK'}</Text>
                </LinearGradient>
              </Pressable>

              <Pressable
                onPress={resetTimer}
                style={({ pressed }) => [s.secondaryActionBtn, pressed && { opacity: 0.7 }]}
              >
                <RotateCcw size={20} color={C.textMuted} />
              </Pressable>
            </View>
          </View>

          <View style={[s.card, { paddingVertical: SPACING.lg }]}>
            <Text style={[TYPOGRAPHY.meta, { marginBottom: SPACING.md, color: C.accentIndigo }]}>Session Length</Text>
            <View style={s.pillsWrap}>
              {RATIOS.map(r => {
                const on = r === ratio;
                return (
                  <Pressable key={r} onPress={() => setRatio(r)} style={[s.pill, on && s.pillOn]}>
                    {on && (
                      <LinearGradient 
                        colors={GRADIENTS.glass} 
                        style={[StyleSheet.absoluteFillObject, { borderRadius: R.pill }]} 
                      />
                    )}
                    <Text style={[s.pillTxt, on && s.pillTxtOn]}>{r}m</Text>
                    <Text style={[s.presetSubTxt, on && { color: C.textSecondary }]}>{PRESET_LABELS[r] || ''}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[s.card, { paddingVertical: SPACING.lg }]}>
            <View style={s.toggleRow}>
              <Text style={TYPOGRAPHY.sectionTitle}>Strict Lock</Text>
              <Pressable onPress={() => setStrictMode(!strictMode)} style={[s.track, strictMode && s.trackOn]}>
                <View style={[s.thumb, strictMode && s.thumbOn]} />
              </Pressable>
            </View>
            <Text style={[TYPOGRAPHY.body, { marginTop: SPACING.xs, fontSize: 13, opacity: 0.6 }]}>
              Disables navigation to prevent context switching.
            </Text>
          </View>

          <View style={s.card}>
            <Text style={TYPOGRAPHY.sectionTitle}>Session Target</Text>

            <Text style={s.subLabel}>Active Syllabus</Text>
            <View style={s.pillsWrap}>
              {EXAM_LIST.map(e => {
                const on = e === exam;
                return (
                  <Pressable key={e} onPress={() => setExam(e)} style={[s.pill, on && s.pillOnExam]}>
                    <Text style={[s.pillTxt, on && s.pillTxtOnExam]}>{e}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={s.subLabel}>Category</Text>
            <View style={s.pillsWrap}>
              {Object.keys(SYLLABUS[exam] ?? {}).map(sec => {
                const on = sec === section;
                return (
                  <Pressable key={sec} onPress={() => setSection(sec)} style={[s.pill, on && s.pillOnExam]}>
                    <Text style={[s.pillTxt, on && s.pillTxtOnExam]}>{pretty(sec)}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={s.subLabel}>Core Topic</Text>
            <View style={s.pillsWrap}>
              {(SYLLABUS[exam]?.[section]?.topics ?? []).map(t => {
                const on = t === topic;
                return (
                  <Pressable key={t} onPress={() => setTopic(t)} style={[s.pill, on && s.pillOnExam]}>
                    <Text style={[s.pillTxt, on && s.pillTxtOnExam]}>{t}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.primaryBG },
  blob: { position: 'absolute', borderRadius: 9999, width: 300, height: 300 },
  blob1: { top: -50, left: -50, backgroundColor: C.accentIndigo },
  blob2: { bottom: -100, right: -100, backgroundColor: C.accentBlue },
  scrollInner: { 
    paddingTop: SPACING.xl, paddingBottom: SPACING.xxxl, alignItems: 'center', 
    width: '100%', maxWidth: 900, alignSelf: 'center' 
  },
  pathBadge: { 
    backgroundColor: 'rgba(255, 255, 255, 0.03)', borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.05)', borderRadius: R.xs, 
    paddingHorizontal: 20, paddingVertical: 12, marginBottom: SPACING.xl 
  },
  pathTxt: { ...TYPOGRAPHY.meta, fontSize: 13, letterSpacing: 0.5, color: C.accentBlue },
  heroBlock: { alignItems: 'center', width: '100%', marginBottom: SPACING.xl },
  heroAura: { position: 'absolute', top: -20, backgroundColor: 'rgba(99, 102, 241, 0.015)' },
  timerWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.xl },
  timerSvg: { position: 'absolute' },
  timerContent: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.04)', backgroundColor: '#05070A' },
  timerHighlight: { position: 'absolute', top: '3%', left: '8%', right: '8%', height: '25%', borderRadius: 999, backgroundColor: 'rgba(255, 255, 255, 0.015)', transform: [{ rotate: '-12deg' }] },
  controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.md, marginTop: SPACING.md, width: '100%' },
  mainActionWrap: { width: '100%', maxWidth: 200, borderRadius: R.sm, overflow: 'hidden', ...SHADOWS.shadowGlass },
  mainActionGradient: { minHeight: 54, paddingHorizontal: 24, borderRadius: R.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  mainActionTxt: { ...TYPOGRAPHY.buttonText, fontSize: 16, letterSpacing: 2 },
  secondaryActionBtn: { width: 54, height: 54, borderRadius: R.sm, backgroundColor: 'rgba(255, 255, 255, 0.02)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)', alignItems: 'center', justifyContent: 'center' },
  card: { width: '100%', backgroundColor: C.surface, borderRadius: R.md, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.04)', padding: SPACING.lg, marginBottom: SPACING.md },
  subLabel: { ...TYPOGRAPHY.meta, fontSize: 10, marginTop: SPACING.lg, marginBottom: SPACING.sm, opacity: 0.5 },
  pillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.xs },
  pill: { minHeight: 48, paddingHorizontal: 16, justifyContent: 'center', borderRadius: R.xs, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)', backgroundColor: 'rgba(255, 255, 255, 0.01)', overflow: 'hidden' },
  pillOn: { borderColor: C.accentIndigo },
  pillTxt: { color: C.textMuted, fontSize: 14, fontWeight: '700' },
  pillTxtOn: { color: C.white },
  pillOnExam: { backgroundColor: 'rgba(56, 189, 248, 0.04)', borderColor: 'rgba(56, 189, 248, 0.2)' },
  pillTxtOnExam: { color: C.accentBlue },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  track: { width: 48, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.5)', borderColor: 'rgba(255,255,255,0.05)', borderWidth: 1, padding: 2, justifyContent: 'center' },
  trackOn: { backgroundColor: C.accentIndigo },
  thumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.textMuted },
  thumbOn: { alignSelf: 'flex-end', backgroundColor: C.white },
  recallWrap: { flexGrow: 1, justifyContent: 'center', padding: SPACING.xl },
  recallTitle: { ...TYPOGRAPHY.cardTitle, color: C.textPrimary, marginBottom: SPACING.xs },
  inputGroup: { width: '100%', marginBottom: 20 },
  inputLabel: { ...TYPOGRAPHY.meta, fontSize: 10, color: C.accentCyan, marginBottom: 8 },
  recallInput: { 
    backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', 
    borderRadius: R.md, padding: SPACING.lg, color: C.textPrimary, fontSize: 15, 
    minHeight: 100, textAlignVertical: 'top' 
  },
  perfRow: { flexDirection: 'row', gap: 16, width: '100%' },
  perfCol: { flex: 1 },
  numericWrap: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', 
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', borderRadius: R.sm, paddingHorizontal: 12 
  },
  numericInput: { flex: 1, height: 48, color: C.white, fontSize: 18, fontWeight: '800' },
  bigBtnWrap: { borderRadius: R.sm, overflow: 'hidden', ...SHADOWS.shadowGlass },
  bigBtn: { minHeight: 56, paddingHorizontal: SPACING.xl, alignItems: 'center', justifyContent: 'center' },
  zenFull: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', width: '100%', paddingVertical: 60 },
  timerWrapZen: { alignItems: 'center', justifyContent: 'center', marginBottom: 180 },
  zenPauseBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 18, paddingHorizontal: 32, borderRadius: R.sm, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  zenPauseTxt: { color: C.textPrimary, opacity: 0.6, fontSize: 13, fontWeight: '800', letterSpacing: 1.5 },
  // Phase B additions
  pipsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: SPACING.md },
  pip: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)' },
  pipActive: { backgroundColor: C.accentCyan, width: 8, height: 8, borderRadius: 4 },
  pipLabel: { fontSize: 10, color: C.textMuted, fontWeight: '800', letterSpacing: 1.5, marginLeft: 8 },
  phaseLabelTxt: { fontSize: 11, fontWeight: '800', letterSpacing: 3, color: C.textMuted, marginBottom: 4 },
  tapHint: { fontSize: 11, color: C.textMuted, opacity: 0.4, marginTop: 6 },
  presetSubTxt: { fontSize: 9, color: C.textMuted, opacity: 0.5, marginTop: 2, textAlign: 'center' },
});
