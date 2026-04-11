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

  if (isFinished) {
    return (
      <View style={s.root}>
        <LinearGradient colors={[C.primaryBG, C.secondaryBG]} style={StyleSheet.absoluteFillObject} />
        <View style={[s.blob, s.blob1, { opacity: 0.03 }]} />
        
        <ScrollView contentContainerStyle={s.recallWrap} keyboardShouldPersistTaps="handled">
          <View style={[s.card, SHADOWS.shadowGlass]}>
            <Text style={s.recallTitle}>Session Complete</Text>
            <Text style={TYPOGRAPHY.body}>
              Lock your learning with a quick summary
            </Text>

            <TextInput
              value={recallText}
              onChangeText={setRecallText}
              placeholder="What did you just master?"
              placeholderTextColor={C.textMuted}
              multiline
              autoFocus
              style={s.recallInput}
            />

            <Pressable 
              onPress={submitRecall} 
              style={({ pressed }) => [s.bigBtnWrap, pressed && { opacity: 0.85 }]}
            >
              <LinearGradient
                colors={GRADIENTS.cta}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.bigBtn}
              >
                <Text style={TYPOGRAPHY.buttonText}>
                  {recallText.length > 0 ? 'Save to Syllabus' : 'Finish Session'}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <LinearGradient colors={[C.primaryBG, C.secondaryBG]} style={StyleSheet.absoluteFillObject} />
      
      {/* Background Atmosphere - Monochromatic & Subtle */}
      <View style={[s.blob, s.blob1, { opacity: 0.08, backgroundColor: C.accentCyan }]} />
      <View style={[s.blob, s.blob2, { opacity: 0.06, backgroundColor: C.accentIndigo }]} />

      <ScrollView
        contentContainerStyle={[
          s.scrollInner,
          { paddingHorizontal: isDesktop ? SPACING.xxxl : SPACING.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
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
          {/* Subtle Halo */}
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
              <Text 
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[timerStyle, { color: C.textPrimary, fontVariant: ['tabular-nums'] }]}
              >
                {mm}:{ss}
              </Text>
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
          <Text style={[TYPOGRAPHY.meta, { marginBottom: SPACING.md, color: C.accentIndigo }]}>Sesssion Duration</Text>
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
  root: {
    flex: 1,
    backgroundColor: C.primaryBG,
  },
  blob: {
    position: 'absolute',
    borderRadius: 9999,
    width: 300,
    height: 300,
  },
  blob1: { top: -50, left: -50, backgroundColor: C.accentIndigo },
  blob2: { bottom: -100, right: -100, backgroundColor: C.accentBlue },

  scrollInner: {
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xxxl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
  },

  pathBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: R.xs,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: SPACING.xl,
  },

  pathTxt: {
    ...TYPOGRAPHY.meta,
    fontSize: 13,
    letterSpacing: 0.5,
    color: C.accentBlue,
  },

  heroBlock: {
    alignItems: 'center',
    width: '100%',
    marginBottom: SPACING.xl,
  },

  heroAura: {
    position: 'absolute',
    top: -20,
    backgroundColor: 'rgba(99, 102, 241, 0.015)',
  },

  timerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },

  timerSvg: {
    position: 'absolute',
  },

  timerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    backgroundColor: '#05070A',
  },

  timerHighlight: {
    position: 'absolute',
    top: '3%',
    left: '8%',
    right: '8%',
    height: '25%',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.015)',
    transform: [{ rotate: '-12deg' }],
  },

  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    marginTop: SPACING.md,
    width: '100%',
  },

  mainActionWrap: {
    width: '100%',
    maxWidth: 200,
    borderRadius: R.sm,
    overflow: 'hidden',
    ...SHADOWS.shadowGlass,
  },

  mainActionGradient: {
    minHeight: 54,
    paddingHorizontal: 24,
    borderRadius: R.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  mainActionTxt: {
    ...TYPOGRAPHY.buttonText,
    fontSize: 16,
    letterSpacing: 2,
  },

  secondaryActionBtn: {
    width: 54,
    height: 54,
    borderRadius: R.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    width: '100%',
    backgroundColor: C.surface,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },

  subLabel: {
    ...TYPOGRAPHY.meta,
    fontSize: 10,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    opacity: 0.5,
  },

  pillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },

  pill: {
    minHeight: 40,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: R.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    overflow: 'hidden',
  },

  pillOn: {
    borderColor: C.accentIndigo,
  },

  pillTxt: {
    color: C.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },

  pillTxtOn: {
    color: C.white,
  },

  pillOnExam: {
    backgroundColor: 'rgba(56, 189, 248, 0.04)',
    borderColor: 'rgba(56, 189, 248, 0.2)',
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
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    padding: 2,
    justifyContent: 'center',
  },

  trackOn: {
    backgroundColor: C.accentIndigo,
  },

  thumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.textMuted,
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
    ...TYPOGRAPHY.cardTitle,
    color: C.textPrimary,
    marginBottom: SPACING.xs,
  },

  recallInput: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: R.md,
    padding: SPACING.lg,
    color: C.textPrimary,
    fontSize: 15,
    minHeight: 120,
    textAlignVertical: 'top',
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
  },

  bigBtnWrap: {
    borderRadius: R.sm,
    overflow: 'hidden',
    ...SHADOWS.shadowGlass,
  },

  bigBtn: {
    minHeight: 54,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
