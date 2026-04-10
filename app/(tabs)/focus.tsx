import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Play, Pause, RotateCcw } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
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

export default function FocusScreen() {
  const { width } = useWindowDimensions();
  const {
    timeLeft,
    isActive,
    isFinished,
    ratio,
    exam,
    section,
    topic,
    strictMode,
    recallText,
    setRatio,
    setExam,
    setSection,
    setTopic,
    setStrictMode,
    setRecallText,
    startTimer,
    pauseTimer,
    resetTimer,
    submitRecall,
  } = useTimer();

  const isDesktop = width >= 768;
  const TIMER_SIZE = isDesktop ? 300 : 240;
  const STROKE_WIDTH = 8;
  const RADIUS = (TIMER_SIZE - STROKE_WIDTH) / 2;
  const CIRCUMF = 2 * Math.PI * RADIUS;
  
  const totalSeconds = ratio * 60;
  const progress = timeLeft / totalSeconds;
  const strokeDashoffset = CIRCUMF - progress * CIRCUMF;

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const ss = String(timeLeft % 60).padStart(2, '0');

  const timerStyle = isDesktop ? TYPOGRAPHY.heroTimerTablet : TYPOGRAPHY.heroTimerMobile;

  if (isFinished) {
    return (
      <View style={s.root}>
        <LinearGradient colors={[C.primaryBG, C.secondaryBG]} style={StyleSheet.absoluteFillObject} />
        <ScrollView contentContainerStyle={s.recallWrap} keyboardShouldPersistTaps="handled">
          <View style={[s.card, SHADOWS.shadowGlass]}>
            <Text style={s.recallTitle}>Active Recall Gate</Text>
            <Text style={TYPOGRAPHY.body}>
              Summarize your session ({recallText.length}/10 chars min)
            </Text>
            <TextInput
              value={recallText}
              onChangeText={setRecallText}
              placeholder="I learned that…"
              placeholderTextColor={C.textMuted}
              multiline
              autoFocus
              style={s.recallInput}
            />
            {recallText.length >= 10 && (
              <Pressable
                onPress={submitRecall}
                style={({ pressed }) => [s.bigBtn, SHADOWS.glowRed, pressed && { opacity: 0.8 }]}
              >
                <Text style={TYPOGRAPHY.buttonText}>Log Session</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <LinearGradient colors={[C.primaryBG, C.secondaryBG]} style={StyleSheet.absoluteFillObject} />
      <View style={[s.blob, s.blob1]} />
      
      <ScrollView
        contentContainerStyle={[s.scrollInner, { paddingHorizontal: isDesktop ? SPACING.xxxl : SPACING.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.pathBadge}>
          <Text style={s.pathTxt} numberOfLines={1}>
            {exam}  ›  {pretty(section)}  ›  {topic}
          </Text>
        </View>

        <View style={[s.timerWrap, { width: TIMER_SIZE, height: TIMER_SIZE }]}>
          <LinearGradient
            colors={GRADIENTS.timerHalo}
            style={[StyleSheet.absoluteFillObject, { borderRadius: 9999, transform: [{ scale: 1.15 }] }]}
          />
          <Svg width={TIMER_SIZE} height={TIMER_SIZE} style={{ position: 'absolute' }}>
            <Circle
              cx={TIMER_SIZE / 2}
              cy={TIMER_SIZE / 2}
              r={RADIUS}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={STROKE_WIDTH}
              fill="transparent"
            />
            <Circle
              cx={TIMER_SIZE / 2}
              cy={TIMER_SIZE / 2}
              r={RADIUS}
              stroke="url(#timerGrad)"
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={CIRCUMF}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              rotation="-90"
              origin={`${TIMER_SIZE / 2}, ${TIMER_SIZE / 2}`}
            />
            <defs>
              <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={GRADIENTS.timerRing[0]} />
                <stop offset="100%" stopColor={GRADIENTS.timerRing[1]} />
              </linearGradient>
            </defs>
          </Svg>
          
          <View style={s.timerInner}>
            <Text style={[timerStyle, Platform.OS === 'web' && ({ fontVariantNumeric: 'tabular-nums' } as any)]}>
              {mm}:{ss}
            </Text>
          </View>
        </View>

        <View style={s.controlsRow}>
          <Pressable
            onPress={isActive ? pauseTimer : startTimer}
            style={({ pressed }) => [
              s.mainActionWrap,
              pressed && { opacity: 0.8 }
            ]}
          >
            <LinearGradient
              colors={GRADIENTS.premiumCTA}
              style={s.mainActionGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {isActive ? <Pause size={32} color={C.white} /> : <Play size={32} color={C.white} fill={C.white} />}
              <Text style={s.mainActionTxt}>{isActive ? 'PAUSE' : 'START'}</Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            onPress={resetTimer}
            style={({ pressed }) => [
              s.secondaryActionBtn,
              pressed && { opacity: 0.6 }
            ]}
          >
            <RotateCcw size={30} color={C.textSecondary} />
          </Pressable>
        </View>

        <View style={[s.card, SHADOWS.shadowSoft]}>
          <Text style={TYPOGRAPHY.sectionTitle}>Duration</Text>
          <View style={s.pillsWrap}>
            {RATIOS.map(r => {
              const on = r === ratio;
              return (
                <Pressable
                  key={r}
                  onPress={() => setRatio(r)}
                  style={[s.pill, on && s.pillOn]}
                >
                  <Text style={[s.pillTxt, on && s.pillTxtOn]}>{r} min</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[s.card, SHADOWS.shadowSoft]}>
          <View style={s.toggleRow}>
            <Text style={TYPOGRAPHY.sectionTitle}>Strict Mode</Text>
            <Pressable
              onPress={() => setStrictMode(!strictMode)}
              style={[s.track, strictMode && s.trackOn]}
            >
              <View style={[s.thumb, strictMode && s.thumbOn]} />
            </Pressable>
          </View>
          <Text style={[TYPOGRAPHY.body, { marginTop: SPACING.xs }]}>
            Disables external navigation while timer is active.
          </Text>
        </View>

        <View style={[s.card, SHADOWS.shadowSoft]}>
          <Text style={TYPOGRAPHY.sectionTitle}>Study Target</Text>

          <Text style={s.subLabel}>Exam</Text>
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

          <Text style={s.subLabel}>Section</Text>
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

          <Text style={s.subLabel}>Topic</Text>
          <View style={s.pillsWrap}>
            {(SYLLABUS[exam]?.[section] ?? []).map(t => {
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
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.primaryBG },
  blob: {
    position: 'absolute',
    borderRadius: 9999,
    width: 700,
    height: 700,
    opacity: 0.15,
  },
  blob1: {
    top: '5%',
    left: '50%',
    marginLeft: -350,
    backgroundColor: '#7C3AED',
  },
  scrollInner: {
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xxxl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  pathBadge: {
    backgroundColor: 'rgba(28, 33, 43, 0.4)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: R.pill,
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginBottom: SPACING.xl,
  },
  pathTxt: {
    ...TYPOGRAPHY.meta,
    letterSpacing: 1.5,
    color: '#D1D5DB',
  },
  timerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xxl,
  },
  timerInner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#07090E',
    borderRadius: 9999,
    margin: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.lg,
    marginBottom: SPACING.xxl,
    width: '100%',
  },
  mainActionWrap: {
    flex: 1,
    maxWidth: 280,
    borderRadius: 36,
    overflow: 'hidden',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
  },
  mainActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.lg,
    minHeight: 72,
    paddingHorizontal: SPACING.xxl,
  },
  mainActionTxt: {
    ...TYPOGRAPHY.buttonText,
    fontSize: 22,
    letterSpacing: 1,
  },
  secondaryActionBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(28, 33, 43, 0.65)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: C.surface,
    borderRadius: R.xl,
    borderWidth: 1,
    borderColor: C.border,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  subLabel: {
    ...TYPOGRAPHY.meta,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  pillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  pill: {
    paddingHorizontal: 28,
    paddingVertical: SPACING.md,
    height: 52,
    justifyContent: 'center',
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.borderStrong,
    backgroundColor: 'rgba(28, 33, 43, 0.4)',
  },
  pillOn: {
    backgroundColor: 'rgba(79, 70, 229, 0.25)',
    borderColor: '#7C3AED',
    borderWidth: 1.5,
  },
  pillTxt: {
    color: C.textSecondary,
    fontSize: 18,
    fontWeight: '700',
  },
  pillTxtOn: {
    color: C.white,
  },
  pillOnExam: {
    backgroundColor: 'rgba(124, 199, 255, 0.15)',
    borderColor: C.accentBlue,
    borderWidth: 1.5,
  },
  pillTxtOnExam: {
    color: C.accentBlue,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  track: {
    width: 52,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.surfaceElevated,
    borderColor: C.borderStrong,
    borderWidth: 1,
    padding: 3,
    justifyContent: 'center',
  },
  trackOn: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.textSecondary,
  },
  thumbOn: {
    alignSelf: 'flex-end',
    backgroundColor: C.white,
  },
  recallWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  recallTitle: {
    ...TYPOGRAPHY.screenTitleMobile,
    color: '#EC4899',
    marginBottom: SPACING.sm,
  },
  recallInput: {
    backgroundColor: C.surfaceElevated,
    borderWidth: 1,
    borderColor: C.borderStrong,
    borderRadius: R.lg,
    padding: SPACING.lg,
    color: C.textPrimary,
    fontSize: 16,
    minHeight: 140,
    textAlignVertical: 'top',
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  bigBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: R.lg,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
});
