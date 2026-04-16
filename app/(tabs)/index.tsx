import {
  C,
  EXAM_DATES,
  EXAM_LIST,
  ExamType,
  GRADIENTS,
  pretty,
  R,
  SHADOWS,
  SPACING,
  TYPOGRAPHY
} from '@/constants/theme';
import { supabase } from '@/lib/supabaseClient';
import { useTimer } from '@/lib/TimerContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  LayoutGrid,
  Minus,
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
  Share,
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

        {/* Global Analytics Hero */}
        <View style={[s.heroCard, SHADOWS.shadowGlass]}>
          <View style={s.heroHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Zap size={20} color={C.accentCyan} />
              <Text style={[TYPOGRAPHY.cardTitle, { marginLeft: 10, fontSize: 18, color: C.textPrimary }]}>{exam} Analytics</Text>
            </View>
            <View style={s.heroBadge}>
              <Text style={s.badgeTxt}>{examDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
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
                <Text style={s.statVal}>{val}</Text>
              </View>
            ))}
          </View>

          <View style={s.barContainer}>
            <View style={s.barBgHero}>
              <LinearGradient
                colors={GRADIENTS.premiumCTA}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[s.barFillHero, { width: `${pct}%` }]}
              />
            </View>
            <Text style={s.pctTxt}>{pct}% COMPLETE • {daily} Q/DAY TARGET</Text>
          </View>
        </View>

        {/* Insights Expansion */}
        <View style={s.insightsGrid}>
          <View style={[s.insightCard, { flex: 1 }]}>
            <Text style={s.insightLabel}>WEEKLY FOCUS</Text>
            <Text style={s.insightVal}>{focusStats.totalHours}h</Text>
          </View>
          <View style={[s.insightCard, { flex: 1 }]}>
            <Text style={s.insightLabel}>VELOCITY (Q/m)</Text>
            <Text style={s.insightVal}>{focusStats.velocity}</Text>
          </View>
        </View>

        <View style={[s.insightCard, { marginBottom: SPACING.xl }]}>
          <Text style={s.insightLabel}>TOP PERFORMING TOPIC (7D)</Text>
          <Text style={[s.insightVal, { fontSize: 18, marginTop: 4 }]} numberOfLines={1}>{focusStats.topTopic}</Text>
        </View>

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

  heroCard: { backgroundColor: C.surface, borderRadius: R.md, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(34, 211, 238, 0.1)' },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  heroBadge: { backgroundColor: '#000', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  badgeTxt: { fontSize: 10, color: C.textSecondary, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statBox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 6, alignItems: 'center' },
  statLbl: { fontSize: 9, color: C.textMuted, marginBottom: 4, fontWeight: '800' },
  statVal: { fontSize: 24, color: C.white, fontWeight: '900' },
  barContainer: { gap: 8 },
  barBgHero: { height: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' },
  barFillHero: { height: '100%' },
  pctTxt: { fontSize: 10, color: C.textMuted, fontWeight: '800', textAlign: 'center' },

  insightsGrid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  insightCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  insightLabel: { fontSize: 9, color: C.textMuted, letterSpacing: 1, fontWeight: '800' },
  insightVal: { fontSize: 24, color: C.white, fontWeight: '900', marginTop: 4 },

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
  retryGradient: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8 }
});
