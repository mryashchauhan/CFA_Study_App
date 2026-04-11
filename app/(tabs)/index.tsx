import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, ActivityIndicator, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Award, Clock, Plus, Minus, Zap, ShieldAlert, Target } from 'lucide-react-native';
import { supabase } from '@/lib/supabaseClient';
import { useTimer } from '@/lib/TimerContext';
import { C, SPACING, TYPOGRAPHY, SYLLABUS, EXAM_LIST, EXAM_DATES, ExamType, pretty, SHADOWS, R } from '@/constants/theme';

const TARGETS: Record<string, number> = {
  'Ethical and Professional Standards': 180, 'Financial Statement Analysis': 156, 'Equity Investments': 156,
  'Fixed Income': 156, 'Quantitative Methods': 102, 'Economics': 102, 'Corporate Issuers': 102,
  'Portfolio Management': 60, 'Derivatives': 60, 'Alternative Investments': 60
};

async function seedTopics(uid: string, exam: ExamType) {
  const sections = SYLLABUS[exam]; if (!sections) return;
  const rows = Object.entries(sections).flatMap(([section, data]) =>
    data.topics.map((topic) => ({
      user_id: uid, exam, section, topic, questionsSolved: 0, questions_correct: 0,
      topic_weight: data.weight || 0, avg_time_per_question: 0, lod: 'Medium'
    }))
  );
  await supabase.from('topics').upsert(rows, { onConflict: 'user_id,exam,section,topic' });
}

export default function PlannerScreen() {
  const { userId, authReady } = useTimer();
  const { width } = useWindowDimensions();
  const [selectedExam, setSelectedExam] = useState<ExamType>('CFA');
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const isDesktop = width > 768;

  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    let { data } = await supabase.from('topics').select('*').eq('user_id', userId).eq('exam', selectedExam);
    if (!data || data.length === 0) {
      await seedTopics(userId, selectedExam);
      const { data: s } = await supabase.from('topics').select('*').eq('user_id', userId).eq('exam', selectedExam);
      data = s;
    }
    setTopics(data || []); setLoading(false);
  }, [userId, selectedExam]);

  useEffect(() => { loadData(); }, [loadData]);

  const bump = async (id: string, delta: number, current: number, target: number) => {
    const val = Math.max(0, Math.min(target, current + delta));
    setTopics(prev => prev.map(t => t.id === id ? { ...t, questionsSolved: val } : t));
    await supabase.from('topics').update({ questionsSolved: val }).eq('id', id);
  };

  const cycleLOD = async (id: string, current: string) => {
    const next = current === 'Easy' ? 'Medium' : current === 'Medium' ? 'Hard' : 'Easy';
    setTopics(prev => prev.map(t => t.id === id ? { ...t, lod: next } : t));
    await supabase.from('topics').update({ lod: next }).eq('id', id);
  };

  const processed = useMemo(() => {
    return topics.map(t => {
      const target = (selectedExam === 'CFA' ? TARGETS[t.section] : 100) || 100;
      const acc = t.questionsSolved > 0 ? (t.questions_correct / t.questionsSolved) * 100 : 0;
      return { ...t, acc, target, prio: (t.topic_weight || 0) * (1 - (acc / 100)) };
    }).sort((a, b) => b.prio - a.prio);
  }, [topics, selectedExam]);

  const stats = useMemo(() => {
    const solved = topics.reduce((s, t) => s + (t.questionsSolved || 0), 0);
    const correct = topics.reduce((s, t) => s + (t.questions_correct || 0), 0);
    const acc = solved > 0 ? (correct / solved * 100).toFixed(1) : "0.0";
    const days = Math.max(1, Math.ceil((new Date(EXAM_DATES[selectedExam] || Date.now()).getTime() - Date.now()) / 86400000));
    return { acc, pace: ((1500 - solved) / days).toFixed(1), days };
  }, [topics, selectedExam]);

  if (!authReady || loading) return <View style={s.center}><ActivityIndicator color={C.accentCyan} size="large" /></View>;

  return (
    <View style={s.root}>
      <LinearGradient colors={['#000', '#090B0F', '#11141B']} style={StyleSheet.absoluteFillObject} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.container}>
          
          <View style={s.header}>
            <View>
              <Text style={s.mainTitle}>Command Center</Text>
              <Text style={s.subTitle}>High-Fidelity Study Engine</Text>
            </View>
            <View style={s.pillRow}>
              {EXAM_LIST.map(e => (
                <Pressable key={e} onPress={() => setSelectedExam(e)} style={[s.pill, e === selectedExam && s.pillOn]}>
                  <Text style={[s.pillTxt, e === selectedExam && s.pillTxtOn]}>{e}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={[s.heroCard, SHADOWS.shadowGlass]}>
            <View style={s.heroStats}>
              <View style={s.statBox}><Text style={s.statLabel}>OVERALL ACCURACY</Text><Text style={s.statValue}>{stats.acc}%</Text></View>
              <View style={s.statBox}><Text style={s.statLabel}>DAILY PACE</Text><Text style={s.statValue}>{stats.pace}</Text></View>
              <View style={s.statBox}><Text style={s.statLabel}>DAYS REMAINING</Text><Text style={s.statValue}>{stats.days}</Text></View>
            </View>
          </View>

          <View style={s.grid}>
            {processed.map(t => {
              const needsReview = t.acc < 70 && t.questionsSolved > 0;
              return (
                <View key={t.id} style={[s.card, { width: isDesktop ? '31.5%' : '100%' }, needsReview && s.dangerCard]}>
                  <View style={s.cardHead}>
                    <Text style={s.cardMeta}>{pretty(t.section).toUpperCase()} ({t.topic_weight}%)</Text>
                    <Pressable onPress={() => cycleLOD(t.id, t.lod)} style={s.lodBadge}>
                      <Zap size={10} color={C.accentCyan} style={{marginRight: 4}} />
                      <Text style={s.lodTxt}>{t.lod.toUpperCase()}</Text>
                    </Pressable>
                  </View>

                  <Text style={s.cardTitle} numberOfLines={2}>{t.topic}</Text>
                  
                  <View style={s.diagStrip}>
                    <View style={s.diagItem}>
                      <Award size={14} color={t.acc >= 70 ? C.success : C.accentRed} />
                      <Text style={[s.diagTxt, { color: t.acc >= 70 ? C.success : C.accentRed }]}>{t.acc.toFixed(1)}%</Text>
                    </View>
                    <View style={s.diagItem}>
                      <Clock size={14} color="rgba(255,255,255,0.4)" />
                      <Text style={s.diagTxt}>{t.avg_time_per_question}s/Q</Text>
                    </View>
                  </View>

                  <View style={s.progressSection}>
                    <View style={s.progLabelRow}>
                       <Text style={s.progTxt}>{t.questionsSolved} / {t.target} Questions</Text>
                       {needsReview && <ShieldAlert size={12} color={C.accentRed} />}
                    </View>
                    <View style={s.barBg}><View style={[s.barFill, { width: `${Math.min(100, (t.questionsSolved / t.target) * 100)}%` }]} /></View>
                  </View>

                  <View style={s.controlStrip}>
                    <Pressable onPress={() => bump(t.id, -1, t.questionsSolved, t.target)} style={s.stepBtn}>
                      <Minus size={18} color="rgba(255,255,255,0.5)" />
                    </Pressable>
                    <View style={s.countDisplay}>
                       <Text style={s.countVal}>{t.questionsSolved}</Text>
                    </View>
                    <Pressable onPress={() => bump(t.id, 1, t.questionsSolved, t.target)} style={s.stepBtn}>
                      <Plus size={18} color={C.white} />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingTop: 60, paddingBottom: 120 },
  container: { width: '100%', maxWidth: 1240, alignSelf: 'center', paddingHorizontal: 30 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40 },
  mainTitle: { color: '#FFF', fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  subTitle: { color: 'rgba(255,255,255,0.3)', fontSize: 13, fontWeight: '600', marginTop: 4 },
  pillRow: { flexDirection: 'row', gap: 10 },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  pillOn: { borderColor: C.accentCyan, backgroundColor: 'rgba(0,217,245,0.1)' },
  pillTxt: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '800' },
  pillTxtOn: { color: '#FFF' },
  heroCard: { backgroundColor: '#11141B', borderRadius: 28, padding: 35, marginBottom: 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  heroStats: { flexDirection: 'row', justifyContent: 'space-between' },
  statBox: { flex: 1 },
  statLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '900', marginBottom: 6 },
  statValue: { color: '#FFF', fontSize: 38, fontWeight: '900', letterSpacing: -1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
  card: { backgroundColor: '#161A22', borderRadius: 24, padding: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  dangerCard: { borderColor: 'rgba(255,59,48,0.2)', backgroundColor: '#1C1616' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardMeta: { color: 'rgba(255,255,255,0.2)', fontSize: 10, fontWeight: '900' },
  lodBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  lodTxt: { color: C.accentCyan, fontSize: 10, fontWeight: '900' },
  cardTitle: { color: '#FFF', fontSize: 20, fontWeight: '800', height: 60, lineHeight: 28 },
  diagStrip: { flexDirection: 'row', gap: 15, marginVertical: 20 },
  diagItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  diagTxt: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  progressSection: { marginTop: 10, marginBottom: 25 },
  progLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  progTxt: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700' },
  barBg: { height: 6, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: C.accentCyan, borderRadius: 3 },
  controlStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 16, padding: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  stepBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  countDisplay: { flex: 1, alignItems: 'center' },
  countVal: { color: '#FFF', fontSize: 20, fontWeight: '900' }
});
