import {
  C,
  EXAM_DATES,
  EXAM_LIST,
  GRADIENTS,
  pretty,
  R,
  SPACING,
  SYLLABUS,
  TYPOGRAPHY
} from '@/constants/theme';
import { supabase } from '@/lib/supabaseClient';
import { useTimer } from '@/lib/TimerContext';
import { getTopicStatus } from '@/utils/topicStatus';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  Flame,
  LayoutGrid,
  Minus,
  Play,
  Plus,
  RefreshCcw,
  Search,
  WifiOff,
  Zap
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from 'react-native';

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

export default function PlannerScreen() {
  const {
    userId, authReady, exam, setExam, setSection, setTopic, refreshAuth,
    topics: globalTopics, userEmail, resetSyllabus, manualMerge
  } = useTimer();
  const { width } = useWindowDimensions();
  const router = useRouter();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showRecoveryEntry, setShowRecoveryEntry] = useState(false);
  const [manualRecoveryID, setManualRecoveryID] = useState('');
  const [focusStats, setFocusStats] = useState({
    totalHours: 0,
    velocity: 0,
    topTopic: 'N/A'
  });
  const [streak, setStreak] = useState(0);
  const [todaySolved, setTodaySolved] = useState(0);
  const [lastStudied, setLastStudied] = useState<Record<string, number>>({});

  const isDesktop = width >= 1200;
  const isTablet = width >= 768 && width < 1200;
  const numCols = isDesktop ? 3 : isTablet ? 2 : 1;

  const CONTENT_MAX_W = 1100;
  const effectiveWidth = Math.min(width, CONTENT_MAX_W);

  const pad = isDesktop ? SPACING.xl : SPACING.lg;
  const gap = SPACING.md;
  const cardW = numCols === 1
    ? '100%'
    : (effectiveWidth - pad * 2 - gap * (numCols - 1)) / numCols;

  useEffect(() => {
    if (!authReady) return;
    setLoading(false);
    if (globalTopics) setTopics(globalTopics || []);

    const fetchAnalytics = async () => {
      const { data } = await supabase
        .from('focus_sessions')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString());

      if (data && data.length > 0) {
        const totalSec = data.reduce((acc, s) => acc + (s.duration_seconds || 0), 0);
        const totalQs = data.reduce((acc, s) => acc + (s.questions_attempted || 0), 0);
        const topicsMap: Record<string, number> = {};
        data.forEach(s => topicsMap[s.topic] = (topicsMap[s.topic] || 0) + 1);
        const top = Object.entries(topicsMap).sort((a, b) => b[1] - a[1])[0][0];

        setFocusStats({
          totalHours: Number((totalSec / 3600).toFixed(1)),
          velocity: totalSec > 0 ? Number((totalQs / (totalSec / 60)).toFixed(2)) : 0,
          topTopic: top
        });
      }
    };
    fetchAnalytics();

    // Streak + today's session metrics
    const fetchStreak = async () => {
      try {
        const { data } = await supabase
          .from('focus_sessions')
          .select('created_at, questions_attempted, topic')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(200);
        if (!data || data.length === 0) { setStreak(0); setTodaySolved(0); setLastStudied({}); return; }
        const studyDates = new Set(data.map(r => {
          const d = new Date(r.created_at);
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
        setStreak(count);
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const tq = data.filter(r => new Date(r.created_at) >= todayStart)
          .reduce((a, r) => a + (r.questions_attempted || 0), 0);
        setTodaySolved(tq);

        // Compute last-studied map: topic → days since last session
        const recency: Record<string, number> = {};
        data.forEach(r => {
          if (!recency[r.topic]) {
            const daysAgo = Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86400000);
            recency[r.topic] = daysAgo;
          }
        });
        setLastStudied(recency);
      } catch (e) { console.warn('Streak fetch failed:', e); }
    };
    fetchStreak();
  }, [globalTopics, authReady, userId]);

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

  const handleSignOut = async () => {
    const performSignOut = async () => {
      const { error } = await supabase.auth.signOut();
      if (error) return;
      router.replace('/');
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Sign out?')) await performSignOut();
    } else {
      Alert.alert('Sign Out', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: performSignOut },
      ]);
    }
  };

  const totalQ = topics.reduce((s, t) => s + t.totalQuestions, 0);
  const solved = topics.reduce((s, t) => s + t.questionsSolved, 0);
  const remain = totalQ - solved;
  const examDate = new Date(EXAM_DATES[exam] ?? Date.now());
  const daysLeft = Math.ceil((examDate.getTime() - Date.now()) / 86_400_000);
  const daily = daysLeft > 0 ? (remain / daysLeft).toFixed(1) : '0';
  const pct = totalQ > 0 ? Math.min(100, Math.round((solved / totalQ) * 100)) : 0;

  // Greeting & pace
  const hour = new Date().getHours();
  const greetingWord = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
  const paceResult = getTopicStatus(pct, daysLeft);
  const paceLabel = paceResult.label;
  const paceColor = paceResult.color;
  const dailyTarget = Math.max(1, Math.ceil(Number(daily)));

  const grouped: Record<string, Topic[]> = {};
  const processed = topics
    .filter(t => t.exam === exam)
    .filter(t =>
      t.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.section.toLowerCase().includes(searchQuery.toLowerCase())
    );

  processed.forEach(t => {
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
        <Text style={[TYPOGRAPHY.sectionTitle, { color: C.white, textAlign: 'center' }]}>Connection Required</Text>
        <Pressable onPress={refreshAuth} style={{ marginTop: 20 }}>
          <LinearGradient colors={GRADIENTS.cta} style={s.retryGradient}>
            <Text style={{ color: C.white, fontWeight: '700' }}>Retry</Text>
          </LinearGradient>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <LinearGradient colors={[C.primaryBG, C.secondaryBG]} style={StyleSheet.absoluteFillObject} />

      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingHorizontal: pad, width: '100%', maxWidth: CONTENT_MAX_W, alignSelf: 'center' }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Exam Pushing Pills */}
        <View style={s.pills}>
          {EXAM_LIST.map(e => {
            const on = e === exam;
            return (
              <Pressable key={e} onPress={() => setExam(e)} style={[s.examPill, on ? s.examPillOn : s.examPillOff]}>
                <Text style={[s.examPillTxt, on && s.examPillTxtOn]}>{e}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Greeting Hero */}
        <View style={s.greetingCard}>
          <Text style={s.dateLabel}>{dateStr}</Text>
          <View style={[s.greetingRow, numCols === 1 && { flexDirection: 'column' }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.greetingText}>{greetingWord}, candidate.</Text>
              <Text style={s.countdownText}>
                {daysLeft} days until your <Text style={{ fontWeight: '900', color: C.white }}>{exam}</Text> exam on {examDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}.
              </Text>
            </View>
            <View style={s.greetingActions}>
              {streak > 0 && (
                <View style={s.streakBadge}>
                  <Flame size={14} color={C.warning} />
                  <Text style={s.streakNum}>{streak}</Text>
                  <Text style={s.streakLabel}>day streak</Text>
                </View>
              )}
              <Pressable onPress={() => router.push('/focus')} style={({ pressed }) => [s.startFocusBtn, pressed && { opacity: 0.85 }]}>
                <LinearGradient colors={GRADIENTS.cta} style={s.startFocusInner}>
                  <Play size={14} color={C.white} fill={C.white} />
                  <Text style={s.startFocusTxt}>Start focus</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Hero Metrics */}
        <View style={[s.heroMetrics, numCols === 1 && { flexDirection: 'column' }]}>
          <View style={[s.metricCard, numCols > 1 && { flex: 1 }]}>
            <Text style={s.metricLabel}>TODAY'S TARGET</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <Text style={s.metricBigNum}>{todaySolved}</Text>
              <Text style={s.metricDenom}>/ {dailyTarget}</Text>
            </View>
            <Text style={s.metricSub}>{todaySolved >= dailyTarget ? 'On pace' : 'In progress'} · {pct}% done</Text>
            <View style={s.metricBar}>
              <LinearGradient colors={GRADIENTS.premiumCTA} start={{x:0,y:0}} end={{x:1,y:0}} style={[s.metricBarFill, { width: `${Math.min(100, Math.round((todaySolved / dailyTarget) * 100))}%` }]} />
            </View>
          </View>
          <View style={[s.metricCard, numCols > 1 && { flex: 1 }]}>
            <Text style={s.metricLabel}>STUDY STREAK</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={s.metricBigNum}>{streak}</Text>
              <Text style={s.metricDenom}>days</Text>
            </View>
            <Text style={s.metricSub}>{streak > 0 ? 'Keep it going!' : 'Start a session today'}</Text>
          </View>
          <View style={[s.metricCard, numCols > 1 && { flex: 1 }]}>
            <Text style={s.metricLabel}>EXAM PACE</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={[s.metricBigNum, { color: paceColor }]}>{pct}%</Text>
              <Text style={[s.metricDenom, { color: paceColor }]}>{paceLabel}</Text>
            </View>
            <Text style={s.metricSub}>{solved} of {totalQ} solved</Text>
          </View>
        </View>

        {/* Today's Plan — Auto-generated */}
        {(() => {
          const examTopics = topics.filter(t => t.exam === exam);
          if (examTopics.length === 0) return null;

          // Score each topic for priority
          const scored = examTopics.map(t => {
            const mastery = t.totalQuestions > 0 ? t.questionsSolved / t.totalQuestions : 0;
            const sectionMeta = SYLLABUS[exam]?.[t.section];
            const weight = sectionMeta?.weight || 10;
            let score = 0;
            let type: 'REVIEW' | 'NEW MATERIAL' | 'PRACTICE' = 'PRACTICE';

            if (t.lod === 'Hard' && mastery < 0.6) { score += 50; type = 'REVIEW'; }
            else if (mastery < 0.3) { score += 40; type = 'NEW MATERIAL'; }
            else if (mastery < 0.6) { score += 30; type = 'REVIEW'; }
            else { score += 10; type = 'PRACTICE'; }

            score += weight; // Higher exam weight = higher priority
            score += (1 - mastery) * 20; // Lower mastery = higher priority

            // Recency factor: topics not studied in >3 days get a boost
            const daysAgo = lastStudied[t.topic] ?? 999;
            if (daysAgo > 3) score += 10;

            return { ...t, score, type, mastery: Math.round(mastery * 100), remaining: t.totalQuestions - t.questionsSolved };
          });

          const tasks = scored.sort((a, b) => b.score - a.score).slice(0, 4);
          const totalEstMin = tasks.length * 25; // ~25 min per task
          const estLabel = totalEstMin >= 60 ? `~${Math.floor(totalEstMin / 60)}h ${totalEstMin % 60}m` : `~${totalEstMin}m`;

          return (
            <View style={{ marginBottom: SPACING.xl }}>
              <View style={s.planHeader}>
                <View>
                  <Text style={s.planKicker}>TODAY'S PLAN · AUTO-GENERATED</Text>
                  <Text style={s.planTitle}>{tasks.length} tasks, {estLabel} total</Text>
                </View>
              </View>
              {tasks.map((task, i) => {
                const isPriority = task.type === 'REVIEW' || task.type === 'NEW MATERIAL';
                const typeColor = task.type === 'REVIEW' ? C.accentCyan : task.type === 'NEW MATERIAL' ? C.accentIndigo : C.textMuted;
                return (
                  <Pressable
                    key={task.id}
                    onPress={() => {
                      setSection(task.section);
                      setTopic(task.topic);
                      router.push('/focus');
                    }}
                    style={({ pressed }) => [s.taskCard, pressed && { opacity: 0.8 }]}
                  >
                    <View style={s.taskIcon}>
                      <Zap size={16} color={C.accentCyan} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={s.taskTypeRow}>
                        <Text style={[s.taskType, { color: typeColor }]}>{task.type}</Text>
                        <Text style={s.taskSection}>{pretty(task.section)}</Text>
                        {isPriority && (
                          <View style={s.priorityBadge}>
                            <Text style={s.priorityTxt}>PRIORITY</Text>
                          </View>
                        )}
                      </View>
                      <Text style={s.taskName} numberOfLines={1}>{task.topic}</Text>
                    </View>
                    <View style={s.taskMeta}>
                      <Text style={s.taskRemaining}>{task.remaining} <Text style={{ fontWeight: '600', color: C.textMuted }}>left</Text></Text>
                      <Text style={s.taskEst}>~25m</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          );
        })()}

        {/* Topic Grid */}
        {loading ? (
          <ActivityIndicator size="large" color={C.accentCyan} style={{ marginTop: 40 }} />
        ) : processed.length === 0 ? (
          <View style={s.noResults}>
            <Text style={{ color: C.textMuted }}>No Topics Found</Text>
          </View>
        ) : (
          Object.entries(grouped).map(([sec, rows]) => (
            <View key={sec} style={{ marginBottom: SPACING.xl }}>
              <View style={s.secHead}>
                <LayoutGrid size={18} color={C.accentCyan} />
                <Text style={[TYPOGRAPHY.sectionTitle, s.sectionLabel]}>{pretty(sec)}</Text>
              </View>

              <View style={[s.grid, { gap }]}>
                {rows.map(t => {
                  const p = t.totalQuestions > 0 ? Math.round((t.questionsSolved / t.totalQuestions) * 100) : 0;
                  const hard = t.lod === 'Hard';
                  const easy = t.lod === 'Easy';
                  const lodColor = hard ? C.accentRed : easy ? C.success : C.warning;
                  const lodBg = hard ? 'rgba(239, 68, 68, 0.1)' : easy ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)';

                  return (
                    <View key={t.id} style={{ width: cardW }}>
                      <View style={[s.topicCard, hard && { borderColor: 'rgba(239, 68, 68, 0.2)' }]}>
                        {/* 1. Navigation Pressable (Sibling) */}
                        <Pressable
                          onPress={() => {
                            setSection(t.section);
                            setTopic(t.topic);
                            router.push('/focus');
                          }}
                          style={({ pressed }) => [s.topicPressArea, pressed && { opacity: 0.7 }]}
                        >
                          <Text style={s.topicMeta} numberOfLines={1}>{pretty(t.section)}</Text>
                          <Text style={s.topicName} numberOfLines={2}>{t.topic}</Text>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                             <Text style={s.solvedSplit}>{t.questionsSolved} solved</Text>
                             <Text style={s.solvedSplit}>{p}%</Text>
                          </View>
                        </Pressable>

                        {/* 2. LOD Badge (Safe sibling) */}
                        <Pressable 
                          onPress={() => cycleLod(t.id)} 
                          style={[s.lodBadge, { backgroundColor: lodBg, position: 'absolute', top: 12, right: 12 }]}
                        >
                          <Text style={[s.lodTxt, { color: lodColor }]}>{t.lod}</Text>
                        </Pressable>

                        {/* 3. Stepper Strip (Safe sibling) */}
                        <View style={s.glassStrip}>
                          <Pressable onPress={() => bump(t.id, -1)} style={s.stepBtn}><Minus size={14} color={C.textMuted} /></Pressable>
                          <Text style={s.stepVal}>{t.questionsSolved}</Text>
                          <Pressable onPress={() => bump(t.id, 1)} style={s.stepBtn}><Plus size={14} color={C.white} /></Pressable>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        )}

        {/* Sync & Recovery Footer */}
        <View style={s.recoverySection}>
          <Text style={s.heroLabel}>SYNC & RECOVERY</Text>
          <View style={{ gap: 10, marginTop: 12 }}>
            <Pressable onPress={() => setShowRecoveryEntry(!showRecoveryEntry)} style={s.syncBtn}>
              <RefreshCcw size={16} color={C.white} /><Text style={{ color: C.white }}>RESTORE HISTORY</Text>
            </Pressable>
            {showRecoveryEntry && (
              <View style={{ gap: 8 }}>
                <TextInput style={s.searchInput} value={manualRecoveryID} onChangeText={setManualRecoveryID} placeholder="Paste ID..." placeholderTextColor="#444" />
                <Pressable onPress={() => manualMerge(manualRecoveryID)} style={[s.syncBtn, { backgroundColor: C.accentCyan }]}><Text style={{ color: '#000' }}>Confirm</Text></Pressable>
              </View>
            )}
            <Pressable onPress={resetSyllabus} style={[s.syncBtn, { backgroundColor: 'rgba(255,165,0,0.05)' }]}><Zap size={16} color={C.warning} /><Text style={{ color: C.warning }}>REPAIR SYLLABUS</Text></Pressable>
            <Pressable onPress={handleSignOut} style={[s.syncBtn, { backgroundColor: 'rgba(239, 68, 68, 0.05)' }]}><Text style={{ color: C.accentRed }}>SIGN OUT</Text></Pressable>
          </View>
          <Text style={{ textAlign: 'center', opacity: 0.2, marginTop: 20 }}>Build v1.5.2 • Final Patch</Text>
        </View>
      </ScrollView>

      {/* SEARCH MOUNT */}
      <View style={s.searchMount}>
        <View style={s.searchBox}>
          <Search size={18} color={C.accentCyan} style={{ marginRight: 12, opacity: 0.4 }} />
          <TextInput placeholder="Search topics..." style={s.input} value={searchQuery} onChangeText={setSearchQuery} placeholderTextColor="#444" />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.primaryBG },
  scroll: { paddingTop: 20, paddingBottom: 120 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pills: { flexDirection: 'row', gap: 10, marginBottom: 24, flexWrap: 'wrap' },
  examPill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 6, borderWidth: 1 },
  examPillOff: { borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)' },
  examPillOn: { borderColor: C.accentCyan, backgroundColor: 'rgba(6,182,212,0.1)' },
  examPillTxt: { color: C.textMuted, fontSize: 13, fontWeight: '700' },
  examPillTxtOn: { color: C.white },

  // Greeting Hero
  greetingCard: { marginBottom: 20 },
  dateLabel: { fontSize: 10, color: C.textMuted, fontWeight: '800', letterSpacing: 1.5, marginBottom: 6 },
  greetingRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  greetingText: { fontSize: 28, fontWeight: '900', color: C.white, marginBottom: 6 },
  countdownText: { fontSize: 13, color: C.textMuted, lineHeight: 20 },
  greetingActions: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,184,0,0.08)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,184,0,0.15)' },
  streakNum: { fontSize: 15, fontWeight: '900', color: C.warning },
  streakLabel: { fontSize: 11, color: C.textMuted, fontWeight: '600' },
  startFocusBtn: { borderRadius: R.xs, overflow: 'hidden' },
  startFocusInner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: R.xs },
  startFocusTxt: { fontSize: 13, fontWeight: '800', color: C.white },
  // Hero Metrics
  heroMetrics: { flexDirection: 'row', gap: 12, marginBottom: SPACING.xl },
  metricCard: { backgroundColor: C.surface, borderRadius: R.md, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  metricLabel: { fontSize: 9, color: C.textMuted, letterSpacing: 1.2, fontWeight: '800', marginBottom: 8 },
  metricBigNum: { fontSize: 32, fontWeight: '900', color: C.white },
  metricDenom: { fontSize: 16, fontWeight: '700', color: C.textMuted },
  metricSub: { fontSize: 11, color: C.textMuted, fontWeight: '600', marginTop: 4 },
  metricBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden', marginTop: 10 },
  metricBarFill: { height: '100%', borderRadius: 2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  secHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  sectionLabel: { color: C.white, fontWeight: '800', fontSize: 18, marginBottom: 0 },

  topicCard: { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', padding: 16, overflow: 'hidden' },
  topicPressArea: { paddingBottom: 12 },
  topicMeta: { fontSize: 9, color: C.textMuted, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  topicName: { fontSize: 21, fontWeight: '900', color: C.textPrimary, lineHeight: 28, marginBottom: 12 },
  solvedSplit: { fontSize: 12, color: C.textSecondary, fontWeight: '700' },
  lodBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  lodTxt: { fontSize: 9, fontWeight: '900' },
  glassStrip: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 8, padding: 4, justifyContent: 'space-between' },
  stepBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 6 },
  stepVal: { color: C.white, fontSize: 18, fontWeight: '800' },

  recoverySection: { marginTop: 40, padding: 20, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 12, marginBottom: 40 },
  syncBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.05)', padding: 14, borderRadius: 8, justifyContent: 'center' },
  searchInput: { backgroundColor: 'rgba(255,255,255,0.05)', color: C.white, padding: 12, borderRadius: 6, fontSize: 13 },
  searchMount: { position: 'absolute', bottom: 30, left: 20, right: 20, zIndex: 100 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 16, height: 56, borderRadius: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20 },
  input: { flex: 1, color: C.white, fontSize: 16, fontWeight: '600' },
  heroLabel: { fontSize: 10, color: C.textMuted, fontWeight: '800', letterSpacing: 1 },
  retryGradient: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8 },
  // Phase F: Today's Plan
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
  planKicker: { fontSize: 9, fontWeight: '800', color: C.textMuted, letterSpacing: 1.2, marginBottom: 4 },
  planTitle: { fontSize: 18, fontWeight: '800', color: C.white },
  taskCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: R.md, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', gap: 14 },
  taskIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(34,211,238,0.06)', alignItems: 'center', justifyContent: 'center' },
  taskTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  taskType: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  taskSection: { fontSize: 9, fontWeight: '700', color: C.textMuted },
  priorityBadge: { backgroundColor: 'rgba(239,68,68,0.12)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  priorityTxt: { fontSize: 8, fontWeight: '900', color: C.accentRed, letterSpacing: 0.5 },
  taskName: { fontSize: 15, fontWeight: '800', color: C.white },
  taskMeta: { alignItems: 'flex-end', flexShrink: 0 },
  taskRemaining: { fontSize: 13, fontWeight: '800', color: C.white },
  taskEst: { fontSize: 10, color: C.textMuted, fontWeight: '600', marginTop: 2 },
  noResults: { paddingVertical: 40, alignItems: 'center' },
});
