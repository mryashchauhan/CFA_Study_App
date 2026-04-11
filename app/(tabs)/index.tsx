import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, ActivityIndicator, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Award, Clock } from 'lucide-react-native';
import { supabase } from '@/lib/supabaseClient';
import { useTimer } from '@/lib/TimerContext';
import { C, SYLLABUS, ExamType, pretty, SHADOWS } from '@/constants/theme';

const TARGETS: Record<string, number> = {
  'Ethical and Professional Standards': 180, 'Financial Statement Analysis': 156, 'Equity Investments': 156,
  'Fixed Income': 156, 'Quantitative Methods': 102, 'Economics': 102, 'Corporate Issuers': 102,
  'Portfolio Management': 60, 'Derivatives': 60, 'Alternative Investments': 60
};

export default function PlannerScreen() {
  const { userId, authReady } = useTimer();
  const { width } = useWindowDimensions();
  const [selectedExam, setSelectedExam] = useState<ExamType>('CFA');
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const isDesktop = width > 768;

  useEffect(() => {
    if (!userId) return;
    const fetchTopics = async () => {
      setLoading(true);
      const { data } = await supabase.from('topics').select('*').eq('user_id', userId).eq('exam', selectedExam);
      if (data) setTopics(data);
      setLoading(false);
    };
    fetchTopics();
  }, [userId, selectedExam]);

  const processedTopics = useMemo(() => {
    return topics.map(t => {
      const target = TARGETS[t.section] || 100;
      const accuracy = t.questionsSolved > 0 ? (t.questions_correct / t.questionsSolved) * 100 : 0;
      const weight = t.topic_weight || 0;
      const priority = weight * (1 - (accuracy / 100));
      const progress = Math.min(100, (t.questionsSolved / target) * 100);
      return { ...t, accuracy, priority, target, progress };
    }).sort((a, b) => b.priority - a.priority);
  }, [topics]);

  const totalSolved = topics.reduce((s, t) => s + (t.questionsSolved || 0), 0);
  const totalCorrect = topics.reduce((s, t) => s + (t.questions_correct || 0), 0);
  const overallAcc = totalSolved > 0 ? (totalCorrect / totalSolved * 100).toFixed(1) : "0.0";
  const dailyPace = ((1500 - totalSolved) / 36).toFixed(1);

  if (!authReady || loading) return <View style={s.center}><ActivityIndicator color={C.accentCyan} /></View>;

  return (
    <View style={s.root}>
      <LinearGradient colors={['#000000', '#0D0F14']} style={StyleSheet.absoluteFillObject} />
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.container}>
          <View style={s.heroCard}>
            <Text style={s.heroTitle}>CFA MAY 17 COCKPIT</Text>
            <View style={s.heroStats}>
              <View style={s.statBox}><Text style={s.statLbl}>ACCURACY</Text><Text style={s.statVal}>{overallAcc}%</Text></View>
              <View style={s.statBox}><Text style={s.statLbl}>PACE</Text><Text style={s.statVal}>{dailyPace} Q/D</Text></View>
            </View>
          </View>

          <View style={s.grid}>
            {processedTopics.map(t => (
              <View key={t.id} style={[s.card, t.accuracy < 70 && t.questionsSolved > 0 && s.cardDanger, { width: isDesktop ? '31%' : '100%' }]}>
                <Text style={s.cardMeta}>{pretty(t.section).toUpperCase()} ({t.topic_weight}%)</Text>
                <Text style={s.cardTitle} numberOfLines={2}>{t.topic}</Text>
                <View style={s.diagRow}>
                   <Award size={14} color={t.accuracy >= 70 ? C.success : C.accentRed} />
                   <Text style={[s.diagTxt, { color: t.accuracy >= 70 ? C.success : C.accentRed }]}>{t.accuracy.toFixed(1)}%</Text>
                   <Clock size={14} color="rgba(255,255,255,0.4)" />
                   <Text style={s.diagTxt}>{t.avg_time_per_question || 0}s/Q</Text>
                </View>
                <Text style={s.progressTxt}>Progress: {t.questionsSolved} / {t.target} Qs</Text>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  scroll: { paddingTop: 60, paddingBottom: 100 },
  container: { width: '100%', maxWidth: 1200, alignSelf: 'center', paddingHorizontal: 24 },
  heroCard: { backgroundColor: '#11141B', borderRadius: 24, padding: 32, marginBottom: 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  heroTitle: { color: C.accentCyan, fontSize: 14, fontWeight: '900', marginBottom: 20, letterSpacing: 2 },
  heroStats: { flexDirection: 'row', gap: 40 },
  statBox: { flex: 1 },
  statLbl: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800', marginBottom: 4 },
  statVal: { color: '#FFF', fontSize: 36, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  card: { backgroundColor: '#161A22', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  cardDanger: { borderColor: 'rgba(255,59,48,0.3)', ...SHADOWS.glowRed },
  cardMeta: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '800', marginBottom: 8 },
  cardTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', marginBottom: 16, height: 50 },
  diagRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  diagTxt: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  progressTxt: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 8 },
  barBg: { height: 4, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: C.accentCyan }
});
