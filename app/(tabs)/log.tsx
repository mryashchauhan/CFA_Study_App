import React, { useEffect, useMemo, useState } from 'react';
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
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
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

  // Chart: last 7 days of focus minutes
  const chartData = useMemo(() => {
    const days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(d);
    }
    return days.map(day => {
      const dayKey = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
      const mins = sessions
        .filter(ses => {
          const sd = new Date(ses.created_at);
          return `${sd.getFullYear()}-${String(sd.getMonth()+1).padStart(2,'0')}-${String(sd.getDate()).padStart(2,'0')}` === dayKey;
        })
        .reduce((a, ses) => a + ses.duration_seconds, 0) / 60;
      return { label: day.toLocaleDateString(undefined, { weekday: 'short' }), minutes: Math.round(mins) };
    });
  }, [sessions]);
  const maxMins = Math.max(1, ...chartData.map(d => d.minutes));

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
        <View style={s.chartCard}>
          <View style={s.chartHeader}>
            <View>
              <Text style={s.chartKicker}>DAILY FOCUS</Text>
              <Text style={s.chartTitle}>Minutes per day</Text>
            </View>
            <View style={s.chartLegend}>
              <View style={s.legendDot} />
              <Text style={s.legendTxt}>Focus</Text>
            </View>
          </View>
          <View style={{ height: 140, marginTop: 16 }}>
            <Svg width="100%" height="140">
              {chartData.map((d, i) => {
                const barW = Math.floor((width - 120) / 7);
                const barMaxH = 100;
                const barH = maxMins > 0 ? Math.max(4, (d.minutes / maxMins) * barMaxH) : 4;
                const x = i * (barW + 8) + 8;
                const y = barMaxH - barH + 8;
                return (
                  <React.Fragment key={i}>
                    <Rect x={x} y={y} width={Math.max(barW - 4, 12)} height={barH} rx={4} fill={d.minutes > 0 ? C.accentCyan : 'rgba(255,255,255,0.04)'} opacity={d.minutes > 0 ? 0.7 + (d.minutes / maxMins) * 0.3 : 1} />
                    <SvgText x={x + (barW - 4) / 2} y={128} fontSize={10} fill={C.textMuted} textAnchor="middle" fontWeight="700">{d.label}</SvgText>
                  </React.Fragment>
                );
              })}
            </Svg>
          </View>
        </View>

        {/* History Tabs */}
        <View style={s.tabRow}>
          {(['sessions', 'topics', 'heatmap'] as const).map(tab => (
            <Pressable key={tab} onPress={() => setHistTab(tab)} style={[s.tabBtn, histTab === tab && s.tabBtnOn]}>
              <Text style={[s.tabTxt, histTab === tab && s.tabTxtOn]}>
                {tab === 'sessions' ? 'Recent sessions' : tab === 'topics' ? 'By topic' : 'Retention heatmap'}
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
          <HeatmapView sessions={sessions} exam={exam} width={Math.min(width, CONTENT_MAX_W) - (isDesktop ? SPACING.xxxl * 2 : SPACING.lg * 2)} />
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
  // Phase D: Chart
  chartCard: { backgroundColor: C.surface, borderRadius: R.md, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', marginBottom: 24 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  chartKicker: { fontSize: 9, color: C.textMuted, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4 },
  chartTitle: { fontSize: 16, color: C.white, fontWeight: '800' },
  chartLegend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 2, backgroundColor: C.accentCyan },
  legendTxt: { fontSize: 11, color: C.textMuted, fontWeight: '600' },
  // Phase E: Tabs
  tabRow: { flexDirection: 'row', gap: 4, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', paddingBottom: 0 },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 10 },
  tabBtnOn: { borderBottomWidth: 2, borderBottomColor: C.white },
  tabTxt: { fontSize: 13, fontWeight: '700', color: C.textMuted },
  tabTxtOn: { color: C.white },
  // Topic mastery
  topicGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  topicMCard: { backgroundColor: C.surface, borderRadius: R.md, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  topicMWeight: { fontSize: 9, fontWeight: '800', color: C.textMuted, letterSpacing: 1, marginBottom: 4 },
  topicMName: { fontSize: 16, fontWeight: '800', color: C.white, marginBottom: 8 },
  topicMBar: { height: 3, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden', marginBottom: 8 },
  topicMBarFill: { height: '100%', borderRadius: 2 },
  topicMFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topicMDue: { fontSize: 11, color: C.textMuted, fontWeight: '600' },
  topicMStatus: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  topicMPct: { fontSize: 24, fontWeight: '900', position: 'absolute', top: 16, right: 16 },
  // Heatmap
  hmCard: { marginBottom: 20 },
  hmHint: { fontSize: 11, color: C.textMuted, opacity: 0.6, marginBottom: 16 },
  hmRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  hmLabel: { width: 120, fontSize: 10, color: C.textSecondary, fontWeight: '600' },
  hmPct: { width: 36, fontSize: 10, color: C.textMuted, fontWeight: '700', textAlign: 'right' },
  hmFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  hmTimeline: { fontSize: 9, color: C.textMuted, fontWeight: '700', letterSpacing: 0.5 },
  hmScale: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hmScaleLbl: { fontSize: 9, color: C.textMuted, fontWeight: '600' },
});

/* ── Topic Mastery Sub-component ── */
function TopicMasteryView({ exam, topics, isDesktop }: { exam: string, topics: any[], isDesktop: boolean }) {
  const sections = SYLLABUS[exam] || {};
  return (
    <View style={s.topicGrid}>
      {Object.entries(sections).map(([sec, meta]) => {
        const secTopics = topics.filter(t => t.exam === exam && t.section === sec);
        const totalQ = secTopics.reduce((a, t) => a + t.totalQuestions, 0);
        const solved = secTopics.reduce((a, t) => a + t.questionsSolved, 0);
        const mastery = totalQ > 0 ? Math.round((solved / totalQ) * 100) : 0;
        const status = mastery >= 75 ? 'ahead' : mastery >= 50 ? 'on-track' : 'behind';
        const statusColor = status === 'ahead' ? C.success : status === 'on-track' ? C.accentCyan : C.accentRed;
        const barColor = status === 'ahead' ? C.success : status === 'on-track' ? C.accentCyan : C.accentRed;
        return (
          <View key={sec} style={[s.topicMCard, { width: isDesktop ? '48%' : '100%' }]}>
            <Text style={s.topicMWeight}>{meta.weight}% OF EXAM</Text>
            <Text style={s.topicMName}>{pretty(sec)}</Text>
            <Text style={[s.topicMPct, { color: statusColor }]}>{mastery}%</Text>
            <View style={s.topicMBar}>
              <View style={[s.topicMBarFill, { width: `${mastery}%`, backgroundColor: barColor }]} />
            </View>
            <View style={s.topicMFooter}>
              <Text style={s.topicMDue}>{totalQ - solved} remaining</Text>
              <Text style={[s.topicMStatus, { color: statusColor }]}>{status}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* ── Retention Heatmap Sub-component ── */
function HeatmapView({ sessions, exam, width }: { sessions: FocusSession[], exam: string, width: number }) {
  const DAYS = 28;
  const sections = Object.keys(SYLLABUS[exam] || {});
  const cellSize = Math.max(8, Math.min(16, (width - 160) / DAYS));
  const cellGap = 2;

  const heatData = useMemo(() => {
    const grid: Record<string, Record<string, number>> = {};
    sections.forEach(sec => { grid[sec] = {}; });
    const today = new Date();
    sessions.filter(ses => ses.exam === exam).forEach(ses => {
      const d = new Date(ses.created_at);
      const dayKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
      if (diff < DAYS && grid[ses.section]) {
        grid[ses.section][dayKey] = (grid[ses.section][dayKey] || 0) + ses.duration_seconds / 60;
      }
    });
    return grid;
  }, [sessions, exam]);

  const allVals = Object.values(heatData).flatMap(row => Object.values(row));
  const maxVal = Math.max(1, ...allVals);

  const days: string[] = [];
  const today = new Date();
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
  }

  return (
    <View style={s.hmCard}>
      <Text style={s.hmHint}>Darker = stronger recall. Based on study intensity.</Text>
      {sections.map(sec => {
        const totalMins = Object.values(heatData[sec] || {}).reduce((a: number, v: number) => a + v, 0);
        return (
          <View key={sec} style={s.hmRow}>
            <Text style={s.hmLabel} numberOfLines={1}>{pretty(sec)}</Text>
            <Svg width={DAYS * (cellSize + cellGap)} height={cellSize + 2}>
              {days.map((dayKey, di) => {
                const val = heatData[sec]?.[dayKey] || 0;
                const intensity = val > 0 ? 0.2 + (val / maxVal) * 0.8 : 0.04;
                return (
                  <Rect
                    key={di}
                    x={di * (cellSize + cellGap)}
                    y={1}
                    width={cellSize}
                    height={cellSize}
                    rx={2}
                    fill={val > 0 ? C.accentCyan : 'rgba(255,255,255,0.04)'}
                    opacity={intensity}
                  />
                );
              })}
            </Svg>
            <Text style={s.hmPct}>{Math.round(totalMins)}m</Text>
          </View>
        );
      })}
      <View style={s.hmFooter}>
        <Text style={s.hmTimeline}>4 WEEKS AGO → TODAY</Text>
        <View style={s.hmScale}>
          <Text style={s.hmScaleLbl}>Less</Text>
          {[0.1, 0.3, 0.6, 0.9].map((op, i) => (
            <View key={i} style={{ width: cellSize, height: cellSize, borderRadius: 2, backgroundColor: C.accentCyan, opacity: op }} />
          ))}
          <Text style={s.hmScaleLbl}>More</Text>
        </View>
      </View>
    </View>
  );
}
