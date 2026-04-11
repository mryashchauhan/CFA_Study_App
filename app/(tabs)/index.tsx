import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, ActivityIndicator, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Award, Clock, Zap } from 'lucide-react-native';
import { supabase } from '@/lib/supabaseClient';
import { useTimer } from '@/lib/TimerContext';
import { C, SYLLABUS, EXAM_LIST, EXAM_DATES, ExamType, pretty, SHADOWS } from '@/constants/theme';

const TARGETS: Record<string, number> = {
  'Ethical and Professional Standards': 180, 'Financial Statement Analysis': 156, 'Equity Investments': 156,
  'Fixed Income': 156, 'Quantitative Methods': 102, 'Economics': 102, 'Corporate Issuers': 102,
  'Portfolio Management': 60, 'Derivatives': 60, 'Alternative Investments': 60
};

async function seedTopics(uid: string, exam: ExamType) {
  const sections = SYLLABUS[exam];
  if (!sections) return;
  const rows = Object.entries(sections).flatMap(([section, data]) =>
    data.topics.map((topic) => ({
      user_id: uid, exam, section, topic,
      questionsSolved: 0, questions_correct: 0,
      topic_weight: data.weight || 0,
      avg_time_per_question: 0
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

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      setLoading(true);
      let { data } = await supabase.from('topics').select('*').eq('user_id', userId).eq('exam', selectedExam);
      if (!data || data.length === 0) {
        await seedTopics(userId, selectedExam);
        const { data: seeded } = await supabase.from('topics').select('*').eq('user_id', userId).eq('exam', selectedExam);
        data = seeded;
      }
      setTopics(data || []);
      setLoading(false);
    };
    load();
  }, [userId, selectedExam]);

  const processedTopics = useMemo(() => {
    return topics.map(t => {
      const target = (selectedExam === 'CFA' ? TARGETS[t.section] : 100) || 100;
      const accuracy = t.questionsSolved > 0 ? (t.questions_correct / t.questionsSolved) * 100 : 0;
      const priority = (t.topic_weight || 0) * (1 - (accuracy / 100));
      return { ...t, accuracy, priority, target, progress: Math.min(100, (t.questionsSolved / target) * 100) };
    }).sort((a, b) => b.priority - a.priority);
  }, [topics, selectedExam]);

  const stats = useMemo(() => {
    const solved = topics.reduce((s, t) => s + (t.questionsSolved || 0), 0);
    const correct = topics.reduce((s, t) => s + (t.questions_correct || 0), 0);
    const acc = solved > 0 ? (correct / solved * 100).toFixed(1) : "0.0";
    const days = Math.max(1, Math.ceil((new Date(EXAM_DATES[selectedExam] || Date.now()).getTime() - Date.now()) / 86400000));
    return { acc, pace: ((1500 - solved) / days).toFixed(1), days };
  }, [topics, selectedExam]);

  if (!authReady || loading) return <View style={s.center}><ActivityIndicator color={C.accentCyan} /></View>;

  return (
    <View style={s.root}>
      <LinearGradient colors={['#000', '#0D0F14']} style={StyleSheet.absoluteFillObject} />
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
            <Text style={s.heroTitle}>{selectedExam} PERFORMANCE</Text>
            <View style={s.heroStats}>
              <View style={s.statBox}><Text style={s.statLabel}>ACCURACY</Text><Text style={s.statValue}>{stats.acc}%</Text></View>
              <View style={s.statBox}><Text style={s.statLabel}>DAILY PACE</Text><Text style={s.statValue}>{stats.pace}</Text></View>
              <View style={s.statBox}><Text style={s.statLabel}>DAYS LEFT</Text><Text style={s.statValue}>{stats.days}</Text></View>
            </View>
          </View>

          <View style={s.grid}>
            {processedTopics.map(t => (
              <View key={t.id} style={[s.card, { width: isDesktop ? '31%' : '100%' }, t.accuracy < 70 && t.questionsSolved > 0 && s.cardDanger]}>
                <Text style={s.cardMeta}>{pretty(t.section).toUpperCase()} ({t.topic_weight}%)</Text>
                <Text style={s.cardTitle} numberOfLines={2}>{t.topic}</Text>
                <View style={s.diagRow}>
                   <Award size={14} color={t.accuracy >= 70 ? C.success : C.accentRed} />
                   <Text style={[s.diagTxt, { color: t.accuracy >= 70 ? C.success : C.accentRed }]}>{t.accuracy.toFixed(1)}%</Text>
                   <Clock size={14} color="rgba(255,255,255,0.4)" /><Text style={s.diagTxt}>{t.avg_time_per_question}s/Q</Text>
                </View>
                <Text style={s.progressTxt}>{t.questionsSolved} / {t.target} Qs</Text>
                <View style={s.barBg}><View style={[s.barFill, { width: `${t.progress}%` }]} /></View>
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
  container: { width: '100%', maxWidth: 1200, alignSelf: 'center', paddingHorizontal: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  mainTitle: { color: '#FFF', fontSize: 24, fontWeight: '900' },
  pillRow: { flexDirection: 'row', gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: '#111', borderWidth: 1, borderColor: '#222' },
  pillOn: { borderColor: C.accentCyan, backgroundColor: 'rgba(0,217,245,0.1)' },
  pillTxt: { color: '#555', fontSize: 11, fontWeight: '800' },
  pillTxtOn: { color: '#FFF' },
  heroCard: { backgroundColor: '#11141B', borderRadius: 24, padding: 32, marginBottom: 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  heroTitle: { color: C.accentCyan, fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 20 },
  heroStats: { flexDirection: 'row', gap: 30 },
  statBox: { flex: 1 },
  statLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: '800', marginBottom: 4 },
  statValue: { color: '#FFF', fontSize: 32, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  card: { backgroundColor: '#161A22', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  cardDanger: { borderColor: 'rgba(255,59,48,0.3)' },
  cardMeta: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '800', marginBottom: 8 },
  cardTitle: { color: '#FFF', fontSize: 18, fontWeight: '800', marginBottom: 16, height: 50 },
  diagRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  diagTxt: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  progressTxt: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 8 },
  barBg: { height: 4, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: C.accentCyan }
});
