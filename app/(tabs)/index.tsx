import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
  Pressable,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, Minus, LayoutGrid, Zap, Target, RefreshCcw, WifiOff } from 'lucide-react-native';
import { supabase } from '@/lib/supabaseClient';
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
  try {
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
  } catch (error) {
    console.warn('Supabase sync failed (seed):', error);
  }
}

export default function PlannerScreen() {
  const { userId, authReady, refreshAuth } = useTimer();
  const { width } = useWindowDimensions();

  const [selectedExam, setSelectedExam] = useState<ExamType>('CFA');
  const [topics, setTopics]   = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  const isDesktop = width >= 1200;
  const isTablet = width >= 768 && width < 1200;
  const numCols = isDesktop ? 3 : isTablet ? 2 : 1;
  
  const CONTENT_MAX_W = 1100;
  const effectiveWidth = Math.min(width, CONTENT_MAX_W);
  
  const pad = isDesktop ? 26 : 19;
  const gap = 8;
  const cardW = numCols === 1
    ? '100%'
    : (effectiveWidth - pad * 2 - gap * (numCols - 1)) / numCols;

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    setLoading(true);

    (async () => {
      try {
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
      } catch (error) {
        console.warn('Supabase sync failed (load):', error);
      } finally {
        if (alive) setLoading(false);
      }
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
      
      await new Promise(res => setTimeout(res, 50));
      
      try {
        await supabase
          .from('topics')
          .update({ questionsSolved: vToSave, updated_at: new Date().toISOString() })
          .eq('id', id);
      } catch (error) {
        console.warn('Supabase sync failed (bump):', error);
      }
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
      try {
        await supabase.from('topics').update({ lod: next }).eq('id', id);
      } catch (error) {
        console.warn('Supabase sync failed (lod):', error);
      }
    },
    [topics],
  );

  const totalQ   = topics.reduce((s, t) => s + t.totalQuestions, 0);
  const solved   = topics.reduce((s, t) => s + t.questionsSolved, 0);
  const remain   = totalQ - solved;
  const examDate = new Date(EXAM_DATES[selectedExam] ?? Date.now());
  const daysLeft = Math.ceil((examDate.getTime() - Date.now()) / 86_400_000);
  const daily    = daysLeft > 0 ? (remain / daysLeft).toFixed(1) : 'Exam Day! 🎯';
  const pct      = totalQ > 0 ? Math.min(100, Math.round((solved / totalQ) * 100)) : 0;

  const grouped: Record<string, Topic[]> = {};
  topics.forEach(t => {
    (grouped[t.section] ??= []).push(t);
  });

  if (!authReady) {
    return (
      <View style={[s.center, { backgroundColor: C.primaryBG }]}>
        <ActivityIndicator size="large" color={C.accentIndigo} />
      </View>
    );
  }

  if (!userId) {
    return (
      <View style={[s.center, { backgroundColor: C.primaryBG, padding: SPACING.xl }]}>
        <WifiOff size={48} color={C.textMuted} style={{ marginBottom: SPACING.lg }} />
        <Text style={[TYPOGRAPHY.sectionTitle, { color: C.white, textAlign: 'center', marginBottom: 8 }]}>Connection Required</Text>
        <Text style={[TYPOGRAPHY.body, { textAlign: 'center', opacity: 0.6, marginBottom: SPACING.xxl }]}>
          Unable to establish a secure session with the syllabus database. Please check your internet connection.
        </Text>
        <Pressable 
          onPress={refreshAuth}
          style={({ pressed }) => [s.retryBtn, pressed && { opacity: 0.8 }]}
        >
          <LinearGradient colors={GRADIENTS.cta} style={s.retryGradient}>
            <RefreshCcw size={18} color={C.white} style={{ marginRight: 8 }} />
            <Text style={TYPOGRAPHY.buttonText}>Retry Connection</Text>
          </LinearGradient>
        </Pressable>
      </View>
    );
  }

  const titleStyle = width >= 768 ? TYPOGRAPHY.screenTitleTablet : TYPOGRAPHY.screenTitleMobile;

  return (
    <View style={s.root}>
      <LinearGradient colors={[C.primaryBG, C.secondaryBG]} style={StyleSheet.absoluteFillObject} />
      
      {/* Background Atmosphere - Obsidians */}
      <View style={[s.blob, s.blob1, { opacity: 0.02 }]} />
      
      <ScrollView 
        contentContainerStyle={[
          s.scroll, 
          { paddingHorizontal: pad, width: '100%', maxWidth: CONTENT_MAX_W, alignSelf: 'center' }
        ]} 
        showsVerticalScrollIndicator={false}
      >
        <View style={s.header}>
          <Text style={[TYPOGRAPHY.screenTitleTablet, { fontSize: isDesktop ? 48 : 34, fontWeight: '800' }]}>Study Planner</Text>
          <Text style={[s.subtitle, { fontSize: isDesktop ? 18 : 15, color: 'rgba(255,255,255,0.5)' }]}>Overview & Progress Tracking</Text>
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
                  on ? s.examPillOn : s.examPillOff,
                  pressed && { opacity: 0.8 }
                ]}
              >
                {on && (
                  <LinearGradient 
                    colors={GRADIENTS.glass} 
                    style={[StyleSheet.absoluteFillObject, { borderRadius: R.xs }]} 
                  />
                )}
                <Text style={[s.examPillTxt, on && s.examPillTxtOn]}>{e}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[s.heroCard, SHADOWS.shadowGlass]}>
          <LinearGradient
            colors={['rgba(255,255,255,0.01)', 'transparent']}
            style={[StyleSheet.absoluteFillObject, { borderRadius: R.md }]}
          />
          <View style={s.heroHeader}>
            <View style={s.heroTtlRow}>
               <Zap size={20} color={C.accentCyan} />
               <Text style={[TYPOGRAPHY.cardTitle, { marginLeft: 10, fontSize: 18, fontWeight: '700', color: C.textPrimary }]}>{selectedExam} Progress</Text>
            </View>
            <View style={s.heroBadge}>
              <Text style={s.badgeTxt}>
                {examDate.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                }).toUpperCase()}
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
                <View style={s.valContainer}>
                  <Text 
                    numberOfLines={1} 
                    adjustsFontSizeToFit 
                    style={s.statVal}
                  >
                    {val}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <View style={s.pacingWrap}>
             <Text style={s.pacing}>
               Required: <Text style={{ color: C.accentCyan, fontWeight: '700' }}>{daily} Qs / day</Text>
             </Text>
          </View>
          <View style={s.barContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[s.barBgHero, { flex: 1 }]}>
                <LinearGradient
                  colors={GRADIENTS.premiumCTA}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[s.barFillHero, { width: `${pct}%` }]}
                />
              </View>
              <Text style={[s.pctTxt, { marginLeft: 12, marginTop: 0 }]}>{pct}%</Text>
            </View>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={C.accentIndigo} style={{ marginTop: SPACING.xxl }} />
        ) : (
          Object.entries(grouped).map(([sec, rows]) => (
            <View key={sec} style={{ marginBottom: SPACING.xl }}>
              <View style={[s.secHead, { justifyContent: 'space-between' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[TYPOGRAPHY.sectionTitle, { fontSize: 20, fontWeight: '800', color: C.white }]}>{pretty(sec)}</Text>
                </View>
                
                <View style={[s.lodBadge, { backgroundColor: 'rgba(234, 179, 8, 0.12)', borderColor: 'rgba(234, 179, 8, 0.2)', borderWidth: 1 }]}>
                  <Text style={[s.lodTxt, { color: C.warning, fontSize: 10 }]}>{rows[0]?.lod?.toUpperCase() || 'MEDIUM'}</Text>
                </View>
              </View>

              <View style={[s.grid, { gap }]}>
                {rows.map(t => {
                  const prog = t.totalQuestions > 0
                    ? Math.min(100, Math.round((t.questionsSolved / t.totalQuestions) * 100))
                    : 0;
                  const hard = t.lod === 'Hard';
                  const easy = t.lod === 'Easy';
                  
                  let lodColor: string = C.warning;
                  let lodBg = 'rgba(245, 158, 11, 0.05)';
                  
                  if (hard) {
                    lodColor = C.accentRed;
                    lodBg = 'rgba(239, 68, 68, 0.08)';
                  } else if (easy) {
                    lodColor = C.success;
                    lodBg = 'rgba(16, 185, 129, 0.08)';
                  }
                  
                  return (
                    <View key={t.id} style={{ width: cardW }}>
                       <View style={s.topicCard}>
                         <View style={s.topicHead}>
                           <Text style={s.topicMeta}>{pretty(t.section).toUpperCase()}</Text>
                           <View style={[s.lodBadge, { backgroundColor: lodBg }]}>
                             <Text style={[s.lodTxt, { color: lodColor }]}>{t.lod}</Text>
                           </View>
                         </View>

                         <Text style={s.topicName} numberOfLines={2}>
                           {t.topic}
                         </Text>

                         <Text style={[s.solvedSplit, { fontSize: 13, color: C.textSecondary }]}>
                            {prog}%  •  {t.questionsSolved}/{t.totalQuestions}
                         </Text>

                         <View style={[s.glassStrip, { marginTop: 6 }]}>
                            <Pressable
                              onPress={() => bump(t.id, -1)}
                              style={({ pressed }) => [s.stepBtn, pressed && { opacity: 0.6 }]}
                            >
                              <Minus size={16} color={C.textMuted} />
                            </Pressable>
                            
                            <Text style={s.stepVal}>{t.questionsSolved}</Text>
                            
                            <Pressable
                              onPress={() => bump(t.id, 1)}
                              style={({ pressed }) => [s.stepBtn, pressed && { opacity: 0.6 }]}
                            >
                              <Plus size={16} color={C.white} />
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
    width: 400,
    height: 400,
  },
  blob1: { top: -100, left: -100, backgroundColor: C.accentIndigo },

  scroll: { paddingTop: SPACING.xl, paddingBottom: SPACING.xxxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  
  header: { marginBottom: SPACING.lg, paddingHorizontal: SPACING.xs },
  subtitle: { ...TYPOGRAPHY.body, fontSize: 13, marginTop: 4, opacity: 0.5 },
  
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: SPACING.xl },
  examPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: R.xs,
    borderWidth: 1,
    overflow: 'hidden',
  },
  examPillOff: {
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  examPillOn: { 
    borderColor: C.accentCyan, 
    borderWidth: 2,
    backgroundColor: 'rgba(6,182,212,0.1)' 
  },
  examPillTxt: { color: C.textMuted, fontSize: 13, fontWeight: '700' },
  examPillTxtOn: { color: C.white },

  heroCard: {
    backgroundColor: C.surface,
    borderRadius: R.md,
    borderWidth: 1.5,
    borderColor: 'rgba(34, 211, 238, 0.2)',
    padding: 18,
    marginBottom: 30,
    overflow: 'hidden',
  },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroTtlRow: { flexDirection: 'row', alignItems: 'center' },
  heroBadge: {
    backgroundColor: '#000',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  badgeTxt: { ...TYPOGRAPHY.meta, color: C.textSecondary, fontSize: 9, letterSpacing: 0.5 },
  
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
    backgroundColor: '#000',
    padding: SPACING.md,
    borderRadius: R.xs,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 12,
  },
  statBox: { 
    alignItems: 'center', 
    justifyContent: 'center',
    flex: 1,
  },
  statLbl: { 
    ...TYPOGRAPHY.meta, 
    marginBottom: 6, 
    fontSize: 9, 
    opacity: 0.6,
    textAlign: 'center',
  },
  valContainer: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  statVal: { color: C.white, fontSize: 40, fontWeight: '900', lineHeight: 48, textAlign: 'center' },
  
  pacingWrap: { marginTop: SPACING.md, alignItems: 'center' },
  pacing: { ...TYPOGRAPHY.body, fontSize: 13, opacity: 0.7 },
  
  barContainer: { marginTop: SPACING.lg },
  barBgHero: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFillHero: { height: 6, borderRadius: 3 },
  pctTxt: {
    color: C.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
    fontWeight: '700',
  },

  secHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingLeft: SPACING.xs },
  sectionLabel: { marginBottom: 0, marginLeft: 8, fontSize: 16, opacity: 0.8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },

  topicCard: {
    backgroundColor: C.surface,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  topicHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  topicMeta: { ...TYPOGRAPHY.meta, fontSize: 9, opacity: 0.4, flex: 1 },
  lodBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  lodTxt: { fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  topicName: { marginBottom: 4, fontSize: 21, fontWeight: '800', color: C.textPrimary, lineHeight: 28 },
  
  topicStatLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progValue: { color: C.textSecondary, fontSize: 11, fontWeight: '700' },
  solvedSplit: { color: C.textMuted, fontSize: 11, fontWeight: '600', opacity: 0.5 },
  
  miniBarBg: { height: 3, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 1.5, marginBottom: SPACING.lg, overflow: 'hidden' },
  miniBarFill: { height: 3, borderRadius: 1.5 },

  glassStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    height: 44,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 25,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepVal: {
    color: C.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    minWidth: 32,
    textAlign: 'center',
  },
  
  retryBtn: {
    borderRadius: R.sm,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 240,
  },
  retryGradient: {
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
