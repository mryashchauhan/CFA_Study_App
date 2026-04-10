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
          <Text style={TYPOGRAPHY.meta} numberOfLines={1}>
            {exam}  ›  {pretty(section)}  ›  {topic}
          </Text>
        </View>

        <View style={[s.timerWrap, { width: TIMER_SIZE, height: TIMER_SIZE }]}>
          <Svg width={TIMER_SIZE} height={TIMER_SIZE} style={{ position: 'absolute' }}>
            <Circle
              cx={TIMER_SIZE / 2}
              cy={TIMER_SIZE / 2}
              r={RADIUS}
              stroke={C.borderStrong}
              strokeWidth={STROKE_WIDTH}
              fill="transparent"
            />
            <Circle
              cx={TIMER_SIZE / 2}
              cy={TIMER_SIZE / 2}
              r={RADIUS}
              stroke={C.textPrimary}
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={CIRCUMF}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              rotation="-90"
              origin={`${TIMER_SIZE / 2}, ${TIMER_SIZE / 2}`}
            />
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
              pressed && { opacity: 0.8 },
              SHADOWS.glowRed
            ]}
          >
            <LinearGradient
              colors={GRADIENTS.cta}
              style={s.mainActionGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {isActive ? <Pause size={28} color={C.white} /> : <Play size={28} color={C.white} fill={C.white} />}
              <Text style={TYPOGRAPHY.buttonText}>{isActive ? 'PAUSE' : 'START'}</Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            onPress={resetTimer}
            style={({ pressed }) => [
              s.secondaryActionBtn,
              pressed && { opacity: 0.6 }
            ]}
          >
            <RotateCcw size={26} color={C.textSecondary} />
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
    width: 500,
    height: 500,
    opacity: 0.2,
  },
  blob1: {
    top: '10%',
    left: '50%',
    marginLeft: -250,
    backgroundColor: C.accentRedSoft,
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
    backgroundColor: C.surfaceSoft,
    borderWidth: 1,
    borderColor: C.borderStrong,
    borderRadius: R.pill,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.xxxl,
  },
  timerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xxxl,
  },
  timerInner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
    borderRadius: 9999,
    margin: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.lg,
    marginBottom: SPACING.xxxl,
    width: '100%',
  },
  mainActionWrap: {
    flex: 1,
    maxWidth: 240,
    borderRadius: 32,
    overflow: 'hidden',
  },
  mainActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    minHeight: 64,
    paddingHorizontal: SPACING.xxl,
  },
  secondaryActionBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.surfaceSoft,
    borderWidth: 1,
    borderColor: C.borderStrong,
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
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    height: 48,
    justifyContent: 'center',
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.borderStrong,
    backgroundColor: C.surfaceSoft,
  },
  pillOn: {
    backgroundColor: C.accentRedSoft,
    borderColor: C.accentRed,
    borderWidth: 1.5,
  },
  pillTxt: {
    color: C.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  pillTxtOn: {
    color: C.white,
  },
  pillOnExam: {
    backgroundColor: C.surfaceElevated,
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
  trackOn: { backgroundColor: C.accentRed, borderColor: C.accentRed },
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
    color: C.accentRed,
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
    backgroundColor: C.accentRed,
    borderRadius: R.lg,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
});
