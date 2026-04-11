import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, ActivityIndicator, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Award, Clock, Plus, Minus, Zap } from 'lucide-react-native';
import { supabase } from '@/lib/supabaseClient';
import { useTimer } from '@/lib/TimerContext';
import { C, SYLLABUS, EXAM_LIST, EXAM_DATES, ExamType, pretty, SHADOWS } from '@/constants/theme';

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

  if (!authReady || loading) return <View style={s.center}><ActivityIndicator color={C.accentCyan} /></View>;

  return (
    <View style={s.root}>
      <LinearGradient colors={['#05070A', '#0D0F14']} style={StyleSheet.absoluteFillObject} />
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.container}>
          <View style={s.header}>
            <Text style={s.mainTitle}>Command Center</Text>
            <View style={s.pillRow}>
              {EXAM_LIST.map(e => (
                <Pressable key={e} onPress={() => setSelectedExam(e)} style={[s.pill, e === selectedExam && s.pillOn]}>
                  <Text style={[s.pillTxt, e === selectedExam && s.pillTxtOn]}>{e}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={s.heroCard}>
            <View style={s.heroStats}>
              <View style={s.statBox}><Text style={s.statLabel}>ACCURACY</Text><Text style={s.statValue}>{processed.length ? (processed.reduce((a,b)=>a+(b.questions_correct),0)/Math.max(1,processed.reduce((a,b)=>a+b.questionsSolved,0))*100).toFixed(1) : 0}%</Text></View>
              <View style={s.statBox}><Text style={s.statLabel}>DAYS LEFT</Text><Text style={s.statValue}>{Math.max(1, Math.ceil((new Date(EXAM_DATES[selectedExam] || Date.now()).getTime() - Date.now()) / 86400000))}</Text></View>
            </View>
          </View>

          <View style={s.grid}>
            {processed.map(t => (
              <View key={t.id} style={[s.card, { width: isDesktop ? '31.5%' : '100%' }]}>
                <View style={s.cardHead}>
                  <Text style={s.cardMeta}>{pretty(t.section).toUpperCase()}</Text>
                  <Pressable onPress={() => cycleLOD(t.id, t.lod)} style={s.lodBadge}><Text style={s.lodTxt}>{t.lod}</Text></Pressable>
                </View>
                <Text style={s.cardTitle} numberOfLines={2}>{t.topic}</Text>
                <View style={s.diagRow}>
                  <Award size={14} color={t.acc >= 70 ? C.success : C.accentRed} /><Text style={[s.diagTxt, { color: t.acc >= 70 ? C.success : C.accentRed }]}>{t.acc.toFixed(1)}%</Text>
                  <Clock size={14} color="#666" /><Text style={s.diagTxt}>{t.avg_time_per_question}s/Q</Text>
                </View>
                <View style={s.progRow}><Text style={s.progTxt}>{t.questionsSolved} / {t.target} Qs</Text></View>
                <View style={s.barBg}><View style={[s.barFill, { width: `${Math.min(100, (t.questionsSolved / t.target) * 100)}%` }]} /></View>
                
                <View style={s.controls}>
                  <Pressable onPress={() => bump(t.id, -1, t.questionsSolved, t.target)} style={s.btn}><Minus size={18} color="#FFF" /></Pressable>
                  <Text style={s.count}>{t.questionsSolved}</Text>
                  <Pressable onPress={() => bump(t.id, 1, t.questionsSolved, t.target)} style={s.btn}><Plus size={18} color="#FFF" /></Pressable>
                </View>
              </View>
            ))}
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 },
  mainTitle: { color: '#FFF', fontSize: 28, fontWeight: '900' },
  pillRow: { flexDirection: 'row', gap: 10 },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: '#111', borderWidth: 1, borderColor: '#222' },
  pillOn: { borderColor: C.accentCyan, backgroundColor: 'rgba(0,217,245,0.1)' },
  pillTxt: { color: '#444', fontSize: 12, fontWeight: '800' },
  pillTxtOn: { color: '#FFF' },
  heroCard: { backgroundColor: '#11141B', borderRadius: 24, padding: 30, marginBottom: 40, borderWidth: 1, borderColor: '#222' },
  heroStats: { flexDirection: 'row', gap: 40 },
  statBox: { flex: 1 },
  statLabel: { color: '#444', fontSize: 10, fontWeight: '900', marginBottom: 5 },
  statValue: { color: '#FFF', fontSize: 32, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  card: { backgroundColor: '#161A22', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#222' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  cardMeta: { color: '#444', fontSize: 10, fontWeight: '900' },
  lodBadge: { backgroundColor: '#222', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  lodTxt: { color: C.accentCyan, fontSize: 9, fontWeight: '900' },
  cardTitle: { color: '#FFF', fontSize: 19, fontWeight: '800', height: 55, lineHeight: 26 },
  diagRow: { flexDirection: 'row', gap: 12, marginVertical: 15, alignItems: 'center' },
  diagTxt: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  progRow: { marginBottom: 8 },
  progTxt: { color: '#444', fontSize: 11, fontWeight: '700' },
  barBg: { height: 4, backgroundColor: '#111', borderRadius: 2, overflow: 'hidden', marginBottom: 20 },
  barFill: { height: '100%', backgroundColor: C.accentCyan },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#000', padding: 8, borderRadius: 12, borderWidth: 1, borderColor: '#222' },
  btn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  count: { color: '#FFF', fontSize: 18, fontWeight: '900' }
});
