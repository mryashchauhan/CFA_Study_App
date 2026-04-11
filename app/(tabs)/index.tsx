import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, ActivityIndicator, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Award, Clock, Zap, Target, Calendar } from 'lucide-react-native';
import { supabase } from '@/lib/supabaseClient';
import { useTimer } from '@/lib/TimerContext';
import { C, SPACING, TYPOGRAPHY, SYLLABUS, EXAM_LIST, EXAM_DATES, ExamType, pretty, SHADOWS, R } from '@/constants/theme';

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
      const target = (selectedExam === 'CFA' ? TARGETS[t.section] : 100) || 100;
      const accuracy = t.questionsSolved > 0 ? (t.questions_correct / t.questionsSolved) * 100 : 0;
      const priority = (t.topic_weight || 0) * (1 - (accuracy / 100));
      const progress = Math.min(100, (t.questionsSolved / target) * 100);
      return { ...t, accuracy, priority, target, progress };
    }).sort((a, b) => b.priority - a.priority);
  }, [topics, selectedExam]);

  const totalSolved = topics.reduce((s, t) => s + (t.questionsSolved || 0), 0);
  const totalCorrect = topics.reduce((s, t) => s + (t.questions_correct || 0), 0);
  const overallAcc = totalSolved > 0 ? (totalCorrect / totalSolved * 100).toFixed(1) : "0.0";
  const examDate = new Date(EXAM_DATES[selectedExam] ?? Date.now());
  const daysLeft = Math.max(1, Math.ceil((examDate.getTime() - Date.now()) / 86_400_000));
  const dailyPace = ((1500 - totalSolved) / daysLeft).toFixed(1);

  if (!authReady || loading) return <View style={s.center}><ActivityIndicator color={C.accentCyan} size="large" /></View>;

  return (
    <View style={s.root}>
      <LinearGradient colors={['#000', '#090B0F', '#11141B']} style={StyleSheet.absoluteFillObject} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.container}>
          
          <View style={s.headerRow}>
            <Text style={s.mainTitle}>Universal Manu</Text>
            <View style={s.pillContainer}>
              {EXAM_LIST.map(e => (
                <Pressable key={e} onPress={() => setSelectedExam(e)} style={[s.examPill, e === selectedExam && s.examPillOn]}>
                  <Text style={[s.pillTxt, e === selectedExam && s.pillTxtOn]}>{e}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={s.heroCard}>
            <LinearGradient colors={['rgba(255,255,255,0.03)', 'transparent']} style={StyleSheet.absoluteFillObject} />
            <View style={s.heroHeader}>
              <Zap size={18} color={C.accentCyan} />
              <Text style={s.heroTitle}>{selectedExam.toUpperCase()} MISSION TELEMETRY</Text>
            </View>
            <View style={s.heroStats}>
              <View style={s.statBox}><Text style={s.statLabel}>ACCURACY</Text><Text style={s.statValue}>{overallAcc}%</Text></View>
              <View style={s.statBox}><Text style={s.statLabel}>DAILY PACE</Text><Text style={s.statValue}>{dailyPace}</Text></View>
              <View style={s.statBox}><Text style={s.statLabel}>DAYS LEFT</Text><Text style={s.statValue}>{daysLeft}</Text></View>
            </View>
          </View>

          <View style={s.grid}>
            {processedTopics.map(t => (
              <View key={t.id} style={[s.topicCard, { width: isDesktop ? '31.5%' : '100%' }, t.accuracy < 70 && t.questionsSolved > 0 && s.dangerCard]}>
                <View style={s.cardHead}>
                  <Text style={s.cardMeta}>{pretty(t.section).toUpperCase()} ({t.topic_weight}%)</Text>
                  {t.accuracy < 70 && t.questionsSolved > 0 && <View style={s.alertDot} />}
                </View>
                <Text style={s.cardTitle} numberOfLines={2}>{t.topic}</Text>
                
                <View style={s.diagStrip}>
                  <View style={s.diagItem}><Award size={14} color={t.accuracy >= 70 ? C.success : C.accentRed} /><Text style={[s.diagTxt, { color: t.accuracy >= 70 ? C.success : C.accentRed }]}>{t.accuracy.toFixed(1)}%</Text></View>
                  <View style={s.diagItem}><Clock size={14} color="rgba(255,255,255,0.4)" /><Text style={s.diagTxt}>{t.avg_time_per_question}s/Q</Text></View>
                </View>

                <View style={s.progressSection}>
                  <Text style={s.progressInfo}>{t.questionsSolved} / {t.target} Questions</Text>
                  <View style={s.barBg}><View style={[s.barFill, { width: `${t.progress}%` }]} /></View>
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 },
  mainTitle: { color: '#FFF', fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  pillContainer: { flexDirection: 'row', gap: 10 },
  examPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  examPillOn: { borderColor: C.accentCyan, backgroundColor: 'rgba(0,217,245,0.1)' },
  pillTxt: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '800' },
  pillTxtOn: { color: '#FFF' },
  heroCard: { backgroundColor: '#11141B', borderRadius: 28, padding: 35, marginBottom: 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', ...SHADOWS.shadowGlass },
  heroHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 25 },
  heroTitle: { color: C.accentCyan, fontSize: 12, fontWeight: '900', letterSpacing: 2 },
  heroStats: { flexDirection: 'row', justifyContent: 'space-between' },
  statBox: { flex: 1 },
  statLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '900', marginBottom: 6 },
  statValue: { color: '#FFF', fontSize: 38, fontWeight: '900', letterSpacing: -1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
  topicCard: { backgroundColor: '#161A22', borderRadius: 24, padding: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  dangerCard: { borderColor: 'rgba(255,59,48,0.2)', backgroundColor: '#1C1616' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardMeta: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '900' },
  alertDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.accentRed },
  cardTitle: { color: '#FFF', fontSize: 20, fontWeight: '800', height: 60, lineHeight: 28 },
  diagStrip: { flexDirection: 'row', gap: 15, marginVertical: 20 },
  diagItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  diagTxt: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  progressSection: { marginTop: 10 },
  progressInfo: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700', marginBottom: 10 },
  barBg: { height: 6, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: C.accentCyan, borderRadius: 3 }
});
