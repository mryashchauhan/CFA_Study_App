import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  History as HistoryIcon, 
  Trash2, 
  Calendar, 
  Clock, 
  Award,
  ChevronRight,
  Flame,
  Target,
  Zap
} from 'lucide-react-native';
import { useTimer } from '@/lib/TimerContext';
import { supabase } from '@/lib/supabaseClient';
import { getTopicStatus } from '@/utils/topicStatus';
import { WeeklyChart } from '@/components/WeeklyChart';
import { TopicMasteryView } from '@/components/TopicMasteryView';
import { StudyHeatmap } from '@/components/StudyHeatmap';
import {
  C,
  R,
  SPACING,
  TYPOGRAPHY,
  SHADOWS,
  GRADIENTS,
  SYLLABUS,
  pretty,
} from '@/constants/theme';

interface FocusSession {
  id: string;
  exam: string;
  section: string;
  topic: string;
  duration_seconds: number;
  questions_attempted: number;
  questions_correct: number;
  notes: string | null;
  created_at: string;
}

export default function HistoryScreen() {
  const { userId, authReady, exam, topics: globalTopics } = useTimer();
  const { width } = useWindowDimensions();
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'7d' | '30d' | 'all'>('7d');

  const isDesktop = width >= 768;
  const CONTENT_MAX_W = 1000;

  // Compute stats from filtered sessions
  const rangeMs = range === '7d' ? 7 * 86400000 : range === '30d' ? 30 * 86400000 : Infinity;
  const cutoff = rangeMs === Infinity ? 0 : Date.now() - rangeMs;
  const filtered = sessions.filter(s => new Date(s.created_at).getTime() >= cutoff);
  const totalMinutes = Math.round(filtered.reduce((a, s) => a + s.duration_seconds, 0) / 60);
  const totalQuestions = filtered.reduce((a, s) => a + s.questions_attempted, 0);
  const totalCorrect = filtered.reduce((a, s) => a + s.questions_correct, 0);
  const retention = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  // Streak: consecutive days with at least one session
  const computeStreak = (): number => {
    if (sessions.length === 0) return 0;
    const studyDates = new Set(sessions.map(s => {
      const d = new Date(s.created_at);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }));
    let count = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (studyDates.has(key)) { count++; } else if (i > 0) { break; }
    }
    return count;
  };
  const streak = computeStreak();
  const [histTab, setHistTab] = useState<'sessions' | 'topics' | 'heatmap'>('sessions');

  useEffect(() => {
    if (!userId || !authReady) return;

    const fetchHistory = async () => {
      try {
        const { data, error } = await supabase
          .from('focus_sessions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        setSessions(data || []);
      } catch (err) {
        console.error('History fetch failed:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();

    // Subscribe to new sessions in real-time
    const channel = supabase
      .channel('history-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'focus_sessions', filter: `user_id=eq.${userId}` },
        (payload) => {
          setSessions((current) => [payload.new as FocusSession, ...current].slice(0, 50));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'focus_sessions', filter: `user_id=eq.${userId}` },
        (payload) => {
          setSessions((current) => current.filter((s) => s.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, authReady]);

  const deleteSession = async (id: string) => {
    try {
      const { error } = await supabase
        .from('focus_sessions')
        .delete()
        .eq('id', id);
      if (error) throw error;
      // State updated via Realtime listener
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  if (!authReady || loading) {
    return (
      <View style={[s.center, { backgroundColor: C.primaryBG }]}>
        <ActivityIndicator size="large" color={C.accentCyan} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <LinearGradient colors={[C.primaryBG, C.secondaryBG]} style={StyleSheet.absoluteFillObject} />
      
      <ScrollView 
        contentContainerStyle={[
          s.scroll, 
          { 
            paddingHorizontal: isDesktop ? SPACING.xxxl : SPACING.lg,
            maxWidth: CONTENT_MAX_W,
            alignSelf: 'center',
            width: '100%'
          }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.header}>
          <View style={s.iconCircle}>
             <HistoryIcon size={24} color={C.accentCyan} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={TYPOGRAPHY.screenTitleMobile}>Study Log</Text>
            <Text style={[TYPOGRAPHY.body, { opacity: 0.5 }]}>Performance & retention data</Text>
          </View>
        </View>

        {/* Range Selector */}
        <View style={s.rangeRow}>
          {(['7d', '30d', 'all'] as const).map(r => (
            <Pressable key={r} onPress={() => setRange(r)} style={[s.rangePill, range === r && s.rangePillOn]}>
              <Text style={[s.rangeTxt, range === r && s.rangeTxtOn]}>{r === 'all' ? 'All' : r.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>

        {/* Stats Strip */}
        <View style={[s.statsStrip, isDesktop ? { flexDirection: 'row' } : { flexDirection: 'row', flexWrap: 'wrap' }]}>
          <View style={[s.statCard, { flex: 1, minWidth: 140 }]}>
            <Clock size={16} color={C.accentCyan} />
            <Text style={s.statNum}>{totalMinutes >= 60 ? `${(totalMinutes / 60).toFixed(1)}h` : `${totalMinutes}m`}</Text>
            <Text style={s.statLabel}>FOCUS TIME</Text>
          </View>
          <View style={[s.statCard, { flex: 1, minWidth: 140 }]}>
            <Target size={16} color={C.accentIndigo} />
            <Text style={s.statNum}>{totalQuestions}</Text>
            <Text style={s.statLabel}>QUESTIONS</Text>
          </View>
          <View style={[s.statCard, { flex: 1, minWidth: 140 }]}>
            <Flame size={16} color={C.warning} />
            <Text style={s.statNum}>{streak}</Text>
            <Text style={s.statLabel}>DAY STREAK</Text>
          </View>
          <View style={[s.statCard, { flex: 1, minWidth: 140 }]}>
            <Award size={16} color={C.success} />
            <Text style={s.statNum}>{retention}%</Text>
            <Text style={s.statLabel}>RETENTION</Text>
          </View>
        </View>

        {/* Daily Focus Chart */}
        <WeeklyChart sessions={sessions} />

        {/* History Tabs */}
        <View style={s.tabRow}>
          {(['sessions', 'topics', 'heatmap'] as const).map(tab => (
            <Pressable key={tab} onPress={() => setHistTab(tab)} style={[s.tabBtn, histTab === tab && s.tabBtnOn]}>
              <Text style={[s.tabTxt, histTab === tab && s.tabTxtOn]}>
                {tab === 'sessions' ? 'Recent sessions' : tab === 'topics' ? 'By topic' : 'Study heatmap'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Tab Content */}
        {histTab === 'sessions' && (
          <>
        {/* Sessions List */}
        {filtered.length === 0 ? (
          <View style={s.emptyState}>
            <View style={s.emptyIcon}>
              <Zap size={32} color={C.accentCyan} />
            </View>
            <Text style={[TYPOGRAPHY.sectionTitle, { color: C.white, marginTop: 16 }]}>No Sessions Yet</Text>
            <Text style={[TYPOGRAPHY.body, { opacity: 0.4, textAlign: 'center', marginTop: 8, maxWidth: 280 }]}>
              Complete a Focus session and your performance data will appear here.
            </Text>
          </View>
        ) : (
          sessions.map((item) => {
            const date = new Date(item.created_at);
            const accuracy = item.questions_attempted > 0 
              ? Math.round((item.questions_correct / item.questions_attempted) * 100) 
              : 0;

            return (
              <View key={item.id} style={[s.sessionCard, SHADOWS.shadowGlass]}>
                <View style={s.cardHeader}>
                  <View style={s.topicInfo}>
                    <Text style={s.metaText}>{item.exam} • {item.section}</Text>
                    <Text style={s.topicTitle}>{item.topic}</Text>
                  </View>
                  <Pressable 
                    onPress={() => deleteSession(item.id)}
                    style={({ pressed }) => [s.deleteBtn, pressed && { opacity: 0.6 }]}
                  >
                    <Trash2 size={16} color={C.textMuted} />
                  </Pressable>
                </View>

                <View style={s.metricsRow}>
                  <View style={s.metricItem}>
                    <Calendar size={14} color={C.accentIndigo} />
                    <Text style={s.metricVal}>
                      {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  <View style={s.metricItem}>
                    <Clock size={14} color={C.accentIndigo} />
                    <Text style={s.metricVal}>
                      {Math.floor(item.duration_seconds / 60)}m {item.duration_seconds % 60}s
                    </Text>
                  </View>
                  <View style={s.metricItem}>
                    <Award size={14} color={C.success} />
                    <Text style={s.metricVal}>{accuracy}% Accuracy</Text>
                  </View>
                </View>

                {item.notes && (
                  <View style={s.notesBox}>
                    <Text style={s.notesText} numberOfLines={3}>{item.notes}</Text>
                  </View>
                )}
              </View>
            );
          })
        )}
        
        {filtered.length > 0 && (
          <Text style={s.footerNote}>Showing {filtered.length} session{filtered.length !== 1 ? 's' : ''}{range !== 'all' ? ` (${range.toUpperCase()})` : ''}</Text>
        )}
          </>
        )}

        {histTab === 'topics' && (
          <TopicMasteryView exam={exam} topics={globalTopics || []} isDesktop={isDesktop} />
        )}

        {histTab === 'heatmap' && (
          <StudyHeatmap sessions={sessions} exam={exam} width={Math.min(width, CONTENT_MAX_W) - (isDesktop ? SPACING.xxxl * 2 : SPACING.lg * 2)} />
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.primaryBG },
  scroll: { paddingTop: 20, paddingBottom: 120 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 16, 
    marginBottom: 32,
    marginTop: 10
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(34, 211, 238, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.1)',
  },
  emptyState: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(34, 211, 238, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.1)',
  },
  sessionCard: {
    backgroundColor: C.surface,
    borderRadius: R.md,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  topicInfo: { flex: 1, marginRight: 16 },
  metaText: {
    ...TYPOGRAPHY.meta,
    color: C.accentBlue,
    fontSize: 10,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  topicTitle: {
    ...TYPOGRAPHY.cardTitle,
    color: C.white,
    fontSize: 18,
    lineHeight: 24,
  },
  deleteBtn: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 8,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricVal: {
    ...TYPOGRAPHY.body,
    fontSize: 12,
    color: C.textSecondary,
    fontWeight: '600',
  },
  notesBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: R.xs,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  notesText: {
    ...TYPOGRAPHY.body,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.6)',
    fontStyle: 'italic',
  },
  footerNote: {
    ...TYPOGRAPHY.meta,
    textAlign: 'center',
    marginTop: 24,
    opacity: 0.3,
    fontSize: 10,
  },
  // Phase C additions
  rangeRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  rangePill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  rangePillOn: { backgroundColor: 'rgba(34, 211, 238, 0.08)', borderColor: 'rgba(34, 211, 238, 0.2)' },
  rangeTxt: { fontSize: 12, fontWeight: '800', color: C.textMuted },
  rangeTxtOn: { color: C.accentCyan },
  statsStrip: { gap: 10, marginBottom: 24 },
  statCard: { backgroundColor: C.surface, borderRadius: R.md, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', alignItems: 'center', gap: 6 },
  statNum: { fontSize: 28, fontWeight: '900', color: C.white },
  statLabel: { fontSize: 9, fontWeight: '800', color: C.textMuted, letterSpacing: 1.2 },
  // Phase E: Tabs
  tabRow: { flexDirection: 'row', gap: 4, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', paddingBottom: 0 },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 10 },
  tabBtnOn: { borderBottomWidth: 2, borderBottomColor: C.white },
  tabTxt: { fontSize: 13, fontWeight: '700', color: C.textMuted },
  tabTxtOn: { color: C.white },
});
