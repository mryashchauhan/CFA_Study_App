import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, Minus } from 'lucide-react-native';
import { supabase } from '@/lib/supabaseClient';
import { useTimer } from '@/lib/TimerContext';
import {
  C,
  R,
  SPACING,
  TYPOGRAPHY,
  SHADOWS,
  SYLLABUS,
  EXAM_LIST,
  EXAM_DATES,
  ExamType,
  pretty,
} from '@/constants/theme';

interface Topic {
  id: string;
  user_id: string;
  exam: string;
  section: string;
  topic: string;
  questionsSolved: number;
  totalQuestions: number;
  lod: 'Easy' | 'Medium' | 'Hard';
}

async function seedTopics(uid: string, exam: ExamType) {
  const sections = SYLLABUS[exam];
  if (!sections) return;
  const rows = Object.entries(sections).flatMap(([section, topics]) =>
    topics.map(topic => ({
      user_id: uid,
      exam,
      section,
      topic,
      questionsSolved: 0,
      totalQuestions: 50,
      lod: 'Medium' as const,
    })),
  );
  await supabase.from('topics').upsert(rows, {
    onConflict: 'user_id,exam,section,topic',
  });
}

export default function PlannerScreen() {
  const { userId, authReady } = useTimer();
  const { width } = useWindowDimensions();

  const [selectedExam, setSelectedExam] = useState<ExamType>('CFA');
  const [topics, setTopics]   = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;
  const numCols = isDesktop ? 3 : isTablet ? 2 : 1;
  const pad = SPACING.xl;
  const gap = SPACING.lg;
  const cardW = numCols === 1
    ? '100%'
    : (width - pad * 2 - gap * (numCols - 1)) / numCols;

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    setLoading(true);

    (async () => {
      const { data } = await supabase
        .from('topics')
        .select('*')
        .eq('user_id', userId)
        .eq('exam', selectedExam)
        .order('section')
        .order('topic');

      if (!alive) return;

      if (!data || data.length === 0) {
        await seedTopics(userId, selectedExam);
        const { data: seeded } = await supabase
          .from('topics')
          .select('*')
          .eq('user_id', userId)
          .eq('exam', selectedExam)
          .order('section')
          .order('topic');
        if (alive) setTopics((seeded ?? []) as Topic[]);
      } else {
        setTopics(data as Topic[]);
      }
      if (alive) setLoading(false);
    })();

    const ch = supabase
      .channel(`topics-${selectedExam}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'topics',
          filter: `user_id=eq.${userId}`,
        },
        payload => {
          if (payload.eventType === 'UPDATE') {
            const u = payload.new as Topic;
            if (u.exam === selectedExam)
              setTopics(prev => prev.map(t => (t.id === u.id ? u : t)));
          } else if (payload.eventType === 'INSERT') {
            const ins = payload.new as Topic;
            if (ins.exam === selectedExam)
              setTopics(prev => {
                if (prev.find(t => t.id === ins.id)) return prev;
                return [...prev, ins];
              });
          } else if (payload.eventType === 'DELETE') {
            const del = payload.old as any;
            setTopics(prev => prev.filter(t => t.id !== del.id));
          }
        },
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [userId, selectedExam]);

  const bump = useCallback(
    async (id: string, delta: number) => {
      let vToSave = 0;
      setTopics(prev =>
        prev.map(t => {
          if (t.id !== id) return t;
          const v = Math.max(0, Math.min(t.totalQuestions, t.questionsSolved + delta));
          vToSave = v;
          return { ...t, questionsSolved: v };
        }),
      );
      
      // Delay slightly to ensure UI reacts first
      await new Promise(res => setTimeout(res, 50));
      
      await supabase
        .from('topics')
        .update({ questionsSolved: vToSave, updated_at: new Date().toISOString() })
        .eq('id', id);
    },
    [],
  );

  const cycleLod = useCallback(
    async (id: string) => {
      const order: ('Easy' | 'Medium' | 'Hard')[] = ['Easy', 'Medium', 'Hard'];
      const row = topics.find(t => t.id === id);
      if (!row) return;
      const next = order[(order.indexOf(row.lod) + 1) % 3];
      setTopics(prev => prev.map(t => (t.id === id ? { ...t, lod: next } : t)));
      await supabase.from('topics').update({ lod: next }).eq('id', id);
    },
    [topics],
  );

  const totalQ   = topics.reduce((s, t) => s + t.totalQuestions, 0);
  const solved   = topics.reduce((s, t) => s + t.questionsSolved, 0);
  const remain   = totalQ - solved;
  const examDate = new Date(EXAM_DATES[selectedExam] ?? Date.now());
  const daysLeft = Math.max(
    1,
    Math.ceil((examDate.getTime() - Date.now()) / 86_400_000),
  );
  const daily    = (remain / daysLeft).toFixed(1);
  const pct      = totalQ > 0 ? Math.min(100, Math.round((solved / totalQ) * 100)) : 0;

  const grouped: Record<string, Topic[]> = {};
  topics.forEach(t => {
    (grouped[t.section] ??= []).push(t);
  });

  if (!authReady) {
    return (
      <LinearGradient colors={[C.primaryBG, C.secondaryBG]} style={s.center}>
        <ActivityIndicator size="large" color={C.accentTeal} />
        <Text style={[TYPOGRAPHY.body, { marginTop: SPACING.md }]}>Authenticating…</Text>
      </LinearGradient>
    );
  }

  const titleStyle = width >= 768 ? TYPOGRAPHY.screenTitleTablet : TYPOGRAPHY.screenTitleMobile;

  return (
    <View style={s.root}>
      <LinearGradient colors={[C.primaryBG, C.secondaryBG]} style={StyleSheet.absoluteFillObject} />
      <View style={[s.blob, s.blob1]} />
      <View style={[s.blob, s.blob2]} />
      
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingHorizontal: pad }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.header}>
          <Text style={titleStyle}>Study Planner</Text>
          <Text style={s.subtitle}>Overview & Progress Tracking</Text>
        </View>

        <View style={s.pills}>
          {EXAM_LIST.map(e => {
            const on = e === selectedExam;
            return (
              <Pressable
                key={e}
                onPress={() => setSelectedExam(e)}
                style={({ pressed }) => [
                  s.examPill,
                  on && s.examPillOn,
                  on && SHADOWS.glowTeal,
                  pressed && { opacity: 0.8 }
                ]}
              >
                <Text style={[s.examPillTxt, on && s.examPillTxtOn]}>{e}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[s.heroCard, SHADOWS.shadowGlass]}>
          <View style={s.heroHeader}>
            <Text style={TYPOGRAPHY.cardTitle}>🎯 {selectedExam} Progress</Text>
            <View style={s.heroBadge}>
              <Text style={TYPOGRAPHY.meta}>
                {examDate.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </View>
          </View>

          <View style={s.statsRow}>
            {[
              ['SOLVED', String(solved)],
              ['LEFT', String(remain)],
              ['DAYS', String(daysLeft)],
            ].map(([lbl, val]) => (
              <View key={lbl} style={s.statBox}>
                <Text style={s.statLbl}>{lbl}</Text>
                <Text style={s.statVal}>{val}</Text>
              </View>
            ))}
          </View>

          <Text style={s.pacing}>
            Required: <Text style={{ color: C.accentTeal, fontWeight: '700' }}>{daily} Qs / day</Text>
          </Text>

          <View style={s.barBgHero}>
            <View style={[s.barFillHero, { width: `${pct}%` }]} />
          </View>
          <Text style={s.pctTxt}>{pct}%</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={C.accentTeal} style={{ marginTop: SPACING.xxl }} />
        ) : (
          Object.entries(grouped).map(([sec, rows]) => (
            <View key={sec} style={{ marginBottom: SPACING.xxl }}>
              <Text style={[TYPOGRAPHY.sectionTitle, s.sectionLabel]}>{pretty(sec)}</Text>

              <View style={[s.grid, { gap }]}>
                {rows.map(t => {
                  const prog = t.totalQuestions > 0
                    ? Math.min(100, Math.round((t.questionsSolved / t.totalQuestions) * 100))
                    : 0;
                  const hard = t.lod === 'Hard';
                  const easy = t.lod === 'Easy';
                  
                  let lodColor = C.warning;
                  let lodBg = 'rgba(251, 191, 36, 0.15)';
                  
                  if (hard) {
                    lodColor = C.accentRed;
                    lodBg = C.accentRedSoft;
                  } else if (easy) {
                    lodColor = C.success;
                    lodBg = 'rgba(52, 211, 153, 0.15)';
                  }

                  return (
                    <View key={t.id} style={{ width: cardW }}>
                       <View 
                        style={[
                          s.topicCard, 
                          SHADOWS.shadowSoft,
                          hard && { borderColor: C.accentRed, ...SHADOWS.glowRed }
                        ]}
                       >
                         <View style={s.topicHead}>
                           <Text style={TYPOGRAPHY.meta} numberOfLines={1}>{pretty(t.section)}</Text>
                           <Pressable
                             onPress={() => cycleLod(t.id)}
                             style={[s.lodBadge, { backgroundColor: lodBg }]}
                           >
                             <Text style={[s.lodTxt, { color: lodColor }]}>{t.lod}</Text>
                           </Pressable>
                         </View>

                         <Text style={[TYPOGRAPHY.cardTitle, s.topicName]} numberOfLines={2}>
                           {t.topic}
                         </Text>

                         <Text style={[TYPOGRAPHY.body, s.progTxt]}>
                           {prog}% • {t.questionsSolved}/{t.totalQuestions}
                         </Text>

                         <View style={s.glassStrip}>
                           <Pressable
                             onPress={() => bump(t.id, -1)}
                             style={({ pressed }) => [s.stepBtn, pressed && { opacity: 0.6 }]}
                           >
                             <Minus size={26} color={C.textSecondary} />
                           </Pressable>
                           <Text style={s.stepVal}>{t.questionsSolved}</Text>
                           <Pressable
                             onPress={() => bump(t.id, 1)}
                             style={({ pressed }) => [
                               s.stepBtn, 
                               s.stepBtnAdd,
                               pressed && { opacity: 0.6 }
                             ]}
                           >
                             <Plus size={26} color={C.white} />
                           </Pressable>
                         </View>
                       </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.primaryBG },
  blob: {
    position: 'absolute',
    borderRadius: 9999,
    width: 600,
    height: 600,
    opacity: 0.3,
  },
  blob1: {
    top: -200,
    left: -150,
    backgroundColor: C.accentTealSoft,
  },
  blob2: {
    bottom: -100,
    right: -200,
    backgroundColor: C.accentBlueSoft,
  },
  scroll: { paddingTop: SPACING.xxxl, paddingBottom: SPACING.xxxl },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: { marginBottom: SPACING.xxl },
  subtitle: { ...TYPOGRAPHY.body, marginTop: SPACING.xs },
  
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.xxl },
  examPill: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.borderStrong,
    backgroundColor: C.surfaceSoft,
  },
  examPillOn: { borderColor: C.accentTeal, backgroundColor: C.surfaceElevated },
  examPillTxt: { color: C.textSecondary, fontSize: 15, fontWeight: '600' },
  examPillTxtOn: { color: C.accentTeal },

  heroCard: {
    backgroundColor: C.surface,
    borderRadius: R.xl,
    borderWidth: 1,
    borderColor: C.border,
    padding: SPACING.xl,
    marginBottom: SPACING.xxxl,
  },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroBadge: {
    backgroundColor: C.surfaceElevated,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: R.sm,
    borderWidth: 1,
    borderColor: C.border,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
  },
  statBox: { alignItems: 'center', flex: 1 },
  statLbl: { ...TYPOGRAPHY.meta, marginBottom: SPACING.xs },
  statVal: { color: C.textPrimary, fontSize: 26, fontWeight: '800' },
  pacing: { ...TYPOGRAPHY.body, textAlign: 'center', marginTop: SPACING.lg, marginBottom: SPACING.md },
  
  barBgHero: {
    height: 8,
    backgroundColor: C.surfaceElevated,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFillHero: {
    height: 8,
    backgroundColor: C.accentTeal,
    borderRadius: 4,
  },
  pctTxt: {
    color: C.textSecondary,
    fontSize: 13,
    textAlign: 'right',
    marginTop: SPACING.xs,
    fontWeight: '600',
  },

  sectionLabel: { marginBottom: SPACING.lg, paddingLeft: SPACING.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },

  topicCard: {
    backgroundColor: C.surface,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    padding: SPACING.lg,
  },
  topicHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  lodBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: R.sm,
  },
  lodTxt: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  topicName: { marginBottom: SPACING.md, fontSize: 22, fontWeight: '800', color: C.textPrimary },
  progTxt: { marginBottom: SPACING.lg },

  glassStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surfaceSoft,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: R.pill,
    borderWidth: 1.5,
    borderColor: C.borderStrong,
    gap: SPACING.lg,
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.surfaceElevated,
    borderWidth: 1.5,
    borderColor: C.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnAdd: {
    backgroundColor: C.accentBlueSoft,
    borderColor: C.accentBlue,
  },
  stepVal: {
    color: C.textPrimary,
    fontSize: 26,
    fontWeight: '800',
    minWidth: 50,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});
