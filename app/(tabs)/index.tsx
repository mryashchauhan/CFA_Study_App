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
import { Plus, Minus, Zap, RefreshCcw, WifiOff } from 'lucide-react-native';
import { supabase } from '@/lib/supabaseClient';
import { useTimer } from '@/lib/TimerContext';
import {
  C,
  R,
  SPACING,
  TYPOGRAPHY,
  SYLLABUS,
  EXAM_LIST,
  EXAM_DATES,
  ExamType,
  pretty,
  GRADIENTS,
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
    const lods: Topic['lod'][] = ['Easy', 'Medium', 'Hard'];
    const rows = Object.entries(sections).flatMap(([section, topics]) =>
      topics.map((topic, idx) => ({
        user_id: uid,
        exam,
        section,
        topic,
        questionsSolved: 0,
        totalQuestions: 50,
        lod: lods[(idx + section.length) % 3],
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

  // Luxury Glass Responsive Constraints
  const CONTENT_MAX_W = 1200;
  const isDesktopGrid = width > 768;
  const numCols = isDesktopGrid ? 3 : 1;
  const cardGap = 24;
  
  // Padding for the root container
  const rootPadding = width > 768 ? 32 : 16;

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

  const totalQ   = topics.reduce((s, t) => s + t.totalQuestions, 0);
  const solved   = topics.reduce((s, t) => s + t.questionsSolved, 0);
  const remain   = totalQ - solved;
  const examDate = new Date(EXAM_DATES[selectedExam] ?? Date.now());
  const daysLeft = Math.ceil((examDate.getTime() - Date.now()) / 86_400_000);
  const daily    = daysLeft > 0 ? (remain / daysLeft).toFixed(1) : 'Exam Day!'; 
  const pct      = totalQ > 0 ? Math.min(100, Math.round((solved / totalQ) * 100)) : 0;

  const grouped: Record<string, Topic[]> = {};
  topics.forEach(t => {
    (grouped[t.section] ??= []).push(t);
  });

  if (!authReady) {
    return (
      <View style={[s.center, { backgroundColor: C.primaryBG }]}>
        <ActivityIndicator size="large" color={C.accentCyan} />
      </View>
    );
  }

  if (!userId) {
    return (
      <View style={[s.center, { backgroundColor: C.primaryBG, padding: SPACING.xl }]}>
        <WifiOff size={48} color={C.textMuted} style={{ marginBottom: SPACING.lg }} />
        <Text style={[TYPOGRAPHY.sectionTitle, { color: C.white, textAlign: 'center', marginBottom: 8 }]}>Connection Required</Text>
        <Pressable onPress={refreshAuth} style={s.retryBtn}>
           <Text style={TYPOGRAPHY.buttonText}>Retry Connection</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <LinearGradient colors={['#0D0F14', '#11141B']} style={StyleSheet.absoluteFillObject} />
      
      <ScrollView 
        contentContainerStyle={s.scroll} 
        showsVerticalScrollIndicator={false}
      >
        {/* Responsive Anchor 1200px Wrapper */}
        <View style={s.anchor}>
          
          <View style={s.header}>
            <Text style={[TYPOGRAPHY.screenTitleTablet, { fontSize: isDesktopGrid ? 56 : 38, fontWeight: '900', color: C.white }]}>Study Planner</Text>
            <Text style={s.subtitle}>Management Cockpit</Text>
          </View>

          <View style={s.pills}>
            {EXAM_LIST.map(e => {
              const on = e === selectedExam;
              return (
                <Pressable
                  key={e}
                  onPress={() => setSelectedExam(e)}
                  style={[s.examPill, on ? s.examPillOn : s.examPillOff]}
                >
                  <Text style={[s.examPillTxt, on && s.examPillTxtOn]}>{e}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Luxury Analytics Hero Card */}
          <View style={[s.heroCard, { shadowOpacity: 0.1 }]}>
            <View style={s.heroHeader}>
              <View style={s.heroTtlRow}>
                 <Zap size={22} color={C.accentCyan} />
                 <Text style={s.heroTitle}>{selectedExam} Performance Overview</Text>
              </View>
              <View style={s.heroBadge}>
                <Text style={s.badgeTxt}>{examDate.toDateString().toUpperCase()}</Text>
              </View>
            </View>

            <View style={s.statsRow}>
               <View style={s.statBox}>
                  <Text style={s.statLbl}>SOLVED</Text>
                  <Text style={s.statVal}>{solved}</Text>
               </View>
               <View style={s.statBox}>
                  <Text style={s.statLbl}>LEFT</Text>
                  <Text style={s.statVal}>{remain}</Text>
               </View>
               <View style={s.statBox}>
                  <Text style={s.statLbl}>DAYS</Text>
                  <Text style={s.statVal}>{daysLeft}</Text>
               </View>
            </View>

            <View style={s.pacingWrap}>
               <Text style={s.pacing}>
                 Required Mastery Pace: <Text style={{ color: C.accentCyan, fontWeight: '800' }}>{daily} Qs / day</Text>
               </Text>
            </View>

            <View style={s.barContainer}>
               <View style={s.barBgHero}>
                 <LinearGradient
                  colors={['#00D9F5', '#0072FF']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={[s.barFillHero, { width: `${pct}%` }]}
                 />
               </View>
               <Text style={s.pctTxt}>{pct}% Mastery</Text>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={C.accentCyan} style={{ marginTop: 60 }} />
          ) : (
            Object.entries(grouped).map(([sec, rows]) => (
              <View key={sec} style={{ marginBottom: 40 }}>
                <View style={s.secHead}>
                  <Text style={s.sectionLabel}>{pretty(sec)}</Text>
                </View>

                <View style={[s.grid, { gap: cardGap }]}>
                  {rows.map(t => {
                    const prog = t.totalQuestions > 0 ? Math.round((t.questionsSolved / t.totalQuestions) * 100) : 0;
                    return (
                      <View key={t.id} style={[s.topicCardWrap, { width: isDesktopGrid ? '31%' : '100%' }]}>
                         <View style={s.topicCard}>
                            <View style={s.topicHead}>
                               <Text style={s.topicMeta}>{pretty(t.section).toUpperCase()}</Text>
                               <View style={s.lodBadge}>
                                  <Text style={s.lodTxt}>{t.lod}</Text>
                               </View>
                            </View>

                            <Text style={s.topicName} numberOfLines={2}>{t.topic}</Text>

                            <Text style={s.solvedSplit}>
                               {prog}% • {t.questionsSolved}/{t.totalQuestions}
                            </Text>

                            <View style={s.glassStrip}>
                               <Pressable onPress={() => bump(t.id, -1)} style={s.stepBtn}>
                                  <Minus size={20} color="rgba(255,255,255,0.6)" />
                               </Pressable>
                               
                               <Text style={s.stepVal}>{t.questionsSolved}</Text>
                               
                               <Pressable onPress={() => bump(t.id, 1)} style={s.stepBtn}>
                                  <Plus size={20} color={C.white} />
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
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D0F14' },
  scroll: { paddingTop: 40, paddingBottom: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  
  anchor: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: 32,
  },

  header: { marginBottom: 24 },
  subtitle: { ...TYPOGRAPHY.body, fontSize: 16, color: 'rgba(255,255,255,0.4)', marginTop: 4, fontWeight: '600' },
  
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32 },
  examPill: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  examPillOn: { 
    borderColor: C.accentCyan, 
    backgroundColor: 'rgba(0,217,245,0.1)' 
  },
  examPillTxt: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '700' },
  examPillTxtOn: { color: C.white },

  heroCard: {
    backgroundColor: '#11141B',
    borderRadius: 32,
    padding: 40,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    shadowColor: '#00D9F5',
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 10,
  },
  heroTitle: { fontSize: 20, fontWeight: '800', color: C.white, marginLeft: 12 },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroTtlRow: { flexDirection: 'row', alignItems: 'center' },
  heroBadge: { backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  badgeTxt: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  
  statsRow: {
    flexDirection: 'row',
    marginTop: 32,
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 24,
    borderRadius: 20,
    gap: 20,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statLbl: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '800', marginBottom: 8 },
  statVal: { color: C.white, fontSize: 36, fontWeight: '900' },
  
  pacingWrap: { marginTop: 20, alignItems: 'center' },
  pacing: { color: 'rgba(255,255,255,0.6)', fontSize: 15 },
  
  barContainer: { marginTop: 24, alignItems: 'center' },
  barBgHero: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFillHero: { height: '100%', borderRadius: 4 },
  pctTxt: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '700', marginTop: 10 },

  secHead: { marginBottom: 12 },
  sectionLabel: { fontSize: 20, fontWeight: '800', color: 'rgba(255,255,255,0.8)' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },

  topicCardWrap: { marginBottom: 12 },
  topicCard: {
    backgroundColor: '#161A22',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  topicHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  topicMeta: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '800' },
  lodBadge: { backgroundColor: 'rgba(0,217,245,0.05)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  lodTxt: { color: C.accentCyan, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  topicName: { fontSize: 22, fontWeight: '800', color: C.white, lineHeight: 30 },
  solvedSplit: { color: 'rgba(255,255,255,0.3)', fontSize: 14, fontWeight: '600', marginTop: 8 },
  
  glassStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 8,
    borderRadius: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  stepVal: { color: C.white, fontSize: 22, fontWeight: '800' },
  
  retryBtn: {
    backgroundColor: C.accentCyan,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
  },
});
