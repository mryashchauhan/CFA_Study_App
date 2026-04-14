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
  SYLLABUS,
  TYPOGRAPHY,
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
    userId, authReady, exam, setExam, topics: globalTopics, userEmail
  } = useTimer();
  const { width } = useWindowDimensions();
  const router = useRouter();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExam, setSelectedExam] = useState<ExamType>(exam);
  const [activeChip, setActiveChip] = useState<ExamType>(exam);
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

    if (globalTopics) {
      setTopics(globalTopics || []);
    }

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
        const top = Object.entries(topicsMap).sort((a,b) => b[1] - a[1])[0][0];

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

  const totalQ = topics.reduce((s, t) => s + t.totalQuestions, 0);
  const solved = topics.reduce((s, t) => s + t.questionsSolved, 0);
  const remain = totalQ - solved;
  const examDate = new Date(EXAM_DATES[selectedExam] ?? Date.now());
  const daysLeft = Math.ceil((examDate.getTime() - Date.now()) / 86_400_000);
  const daily = daysLeft > 0 ? (remain / daysLeft).toFixed(1) : 'Exam Day! 🎯';
  const pct = totalQ > 0 ? Math.min(100, Math.round((solved / totalQ) * 100)) : 0;

  const grouped: Record<string, Topic[]> = {};
  const processed = topics.filter(t =>
    t.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.section.toLowerCase().includes(searchQuery.toLowerCase())
  );

  processed.forEach(t => {
    (grouped[t.section] ??= []).push(t);
  });

  const handleSync = async () => {
    Alert.alert(
      'Sync Workspace',
      'This MAGIC LINK will instantly pair your other device to this study history without any login.\n\nInstructions:\n1. Share this link to your laptop/other device.\n2. Open it there to sync everything.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate Link',
          onPress: async () => {
            try {
              // Fetch the current secure session tokens for the handshake
              const { data: { session } } = await supabase.auth.getSession();
              const rt = session?.refresh_token;

              const syncURL = `https://cfa-study-app-self.vercel.app/?sync=${userId}${rt ? `&rt=${rt}` : ''}`;

              await Share.share({
                message: syncURL, // NO TEXT PREFIX - Ensures browsers open ONLY the URL
                url: syncURL,
              });
            } catch (error: any) {
              Alert.alert('Sync Error', error.message);
            }
          }
        }
      ]
    );
  };

  if (!authReady) {
    return (
      <View style={[s.center, { backgroundColor: C.primaryBG }]}>
        <ActivityIndicator size="large" color={C.accentCyan} />
        <Text style={[TYPOGRAPHY.body, { color: C.white, marginTop: 16, opacity: 0.6 }]}>Initializing R1 Sync...</Text>
      </View>
    );
  }

  if (!userId) {
    return (
      <View style={[s.center, { backgroundColor: C.primaryBG, padding: SPACING.xl }]}>
        <WifiOff size={48} color={C.textMuted} style={{ marginBottom: SPACING.lg }} />
        <Text style={[TYPOGRAPHY.sectionTitle, { color: C.white, textAlign: 'center', marginBottom: 8 }]}>Connection Required</Text>
        <Text style={[TYPOGRAPHY.body, { textAlign: 'center', opacity: 0.6, marginBottom: SPACING.xxl }]}>
          Unable to establish a secure session with the syllabus database. Please check your internet connection.
        </Text>
        <Pressable
          onPress={refreshAuth}
          style={({ pressed }) => [s.retryBtn, pressed && { opacity: 0.8 }]}
        >
          <LinearGradient colors={GRADIENTS.cta} style={s.retryGradient}>
            <RefreshCcw size={18} color={C.white} style={{ marginRight: 8 }} />
            <Text style={TYPOGRAPHY.buttonText}>Retry Connection</Text>
          </LinearGradient>
        </Pressable>
      </View>
    );
  }

  const titleStyle = width >= 768 ? TYPOGRAPHY.screenTitleTablet : TYPOGRAPHY.screenTitleMobile;

  return (
    <View style={s.root}>
      <LinearGradient colors={[C.primaryBG, C.secondaryBG]} style={StyleSheet.absoluteFillObject} />

      {/* Background Atmosphere - Obsidians */}
      <View style={[s.blob, s.blob1, { opacity: 0.02 }]} />

      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingHorizontal: pad, width: '100%', maxWidth: CONTENT_MAX_W, alignSelf: 'center' }
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >


        <View style={s.pills}>
          {EXAM_LIST.map(e => {
            const on = e === selectedExam;
            return (
              <Pressable
                key={e}
                onPress={() => {
                  setSelectedExam(e);
                  setExam(e);
                }}
                style={({ pressed }) => [
                  s.examPill,
                  on ? s.examPillOn : s.examPillOff,
                  pressed && { opacity: 0.8 }
                ]}
              >
                {on && (
                  <LinearGradient
                    colors={GRADIENTS.glass}
                    style={[StyleSheet.absoluteFillObject, { borderRadius: R.xs }]}
                  />
                )}
                <Text style={[s.examPillTxt, on && s.examPillTxtOn]}>{e}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[s.heroCard, SHADOWS.shadowGlass]}>
          <LinearGradient
            colors={['rgba(255,255,255,0.01)', 'transparent']}
            style={[StyleSheet.absoluteFillObject, { borderRadius: R.md }]}
          />
          <View style={s.heroHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Zap size={20} color={C.accentCyan} />
              <Text style={[TYPOGRAPHY.cardTitle, { marginLeft: 10, fontSize: 18, fontWeight: '700', color: C.textPrimary }]}>{selectedExam} Analytics</Text>
            </View>
            <View style={s.heroBadge}>
              <Text style={s.badgeTxt}>
                {examDate.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
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
                <View style={s.valContainer}>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={s.statVal}
                  >
                    {val}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <View style={s.pacingWrap}>
            <Text style={s.pacing}>
              Required: <Text style={{ color: C.accentCyan, fontWeight: '700' }}>{daily} Qs / day</Text>
            </Text>
          </View>

          <View style={[s.barContainer, { flexDirection: 'row', alignItems: 'center' }]}>
            <View style={[s.barBgHero, { flex: 1, marginRight: 12 }]}>
              <LinearGradient
                colors={GRADIENTS.premiumCTA}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[s.barFillHero, { width: `${pct}%` }]}
              />
            </View>
            <Text style={[s.pctTxt, { marginTop: 0 }]}>{pct}%</Text>
          </View>
        </View>

        {/* Focus Insights Expansion (v1.5.0) */}
        <View style={s.insightsGrid}>
           <View style={[s.insightCard, { flex: 1 }]}>
              <Text style={s.insightLabel}>WEEKLY FOCUS</Text>
              <Text style={s.insightVal}>{focusStats.totalHours}h</Text>
              <View style={s.miniProgress}><View style={[s.miniFill, { width: '65%', backgroundColor: C.accentCyan }]} /></View>
           </View>
           <View style={[s.insightCard, { flex: 1 }]}>
              <Text style={s.insightLabel}>VELOCITY (Q/m)</Text>
              <Text style={s.insightVal}>{focusStats.velocity}</Text>
              <View style={s.miniProgress}><View style={[s.miniFill, { width: '45%', backgroundColor: C.accentIndigo }]} /></View>
           </View>
        </View>

        <View style={[s.insightCard, { marginBottom: SPACING.xl }]}>
           <Text style={s.insightLabel}>TOP PERFORMING TOPIC (7D)</Text>
           <Text style={[s.insightVal, { fontSize: 18, marginTop: 4 }]} numberOfLines={1}>{focusStats.topTopic}</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={C.accentCyan} style={{ marginTop: SPACING.xxl }} />
        ) : processed.length === 0 ? (
          <View style={s.noResults}>
            <Search size={48} color={C.textMuted} style={{ opacity: 0.2, marginBottom: SPACING.lg }} />
            <Text style={[TYPOGRAPHY.sectionTitle, { color: C.textPrimary, opacity: 0.5, textAlign: 'center' }]}>No Topics Found</Text>
            <Text style={[TYPOGRAPHY.body, { textAlign: 'center', opacity: 0.4, marginTop: 4 }]}>Try adjusting your search query.</Text>
          </View>
        ) : (
          Object.entries(grouped).map(([sec, rows]) => (
            <View key={sec} style={{ marginBottom: SPACING.xl }}>
              <View style={s.secHead}>
                <LayoutGrid size={18} color={C.accentCyan} />
                <Text style={[TYPOGRAPHY.sectionTitle, s.sectionLabel, { fontSize: 20, fontWeight: '800', color: C.white }]}>{pretty(sec)}</Text>
              </View>

              <View style={[s.grid, { gap }]}>
                {rows.map(t => {
                  const prog = t.totalQuestions > 0
                    ? Math.min(100, Math.round((t.questionsSolved / t.totalQuestions) * 100))
                    : 0;
                  const hard = t.lod === 'Hard';
                  const easy = t.lod === 'Easy';

                  let lodColor: string = C.warning;
                  let lodBg = 'rgba(245, 158, 11, 0.05)';

                  if (hard) {
                    lodColor = C.accentRed;
                    lodBg = 'rgba(239, 68, 68, 0.08)';
                  } else if (easy) {
                    lodColor = C.success;
                    lodBg = 'rgba(16, 185, 129, 0.08)';
                  }

                  return (
                    <View key={t.id} style={{ width: cardW }}>
                      <Pressable
                        onPress={() => {
                          setExam(selectedExam);
                          setSection(t.section);
                          setTopic(t.topic);
                          router.push('/focus');
                        }}
                        style={({ pressed }) => [
                          s.topicCard,
                          hard && { borderColor: 'rgba(239, 68, 68, 0.2)' },
                          pressed && { opacity: 0.9, backgroundColor: 'rgba(255,255,255,0.02)' }
                        ]}
                      >
                        <View style={s.topicHead}>
                          <Text style={s.topicMeta} numberOfLines={1}>{pretty(t.section)}</Text>
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation();
                              cycleLod(t.id);
                            }}
                            style={[s.lodBadge, { backgroundColor: lodBg }]}
                          >
                            <Text style={[s.lodTxt, { color: lodColor }]}>{t.lod}</Text>
                          </Pressable>
                        </View>

                        <Text style={[TYPOGRAPHY.cardTitle, s.topicName, { fontSize: isDesktop ? 22 : 22 }]} numberOfLines={2}>
                          {t.topic}
                        </Text>

                        <Text style={[s.solvedSplit, { fontSize: 13, marginBottom: SPACING.lg, color: C.textSecondary }]}>
                          {prog}% • {t.questionsSolved}/{t.totalQuestions}
                        </Text>

                        <View style={s.glassStrip}>
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation();
                              bump(t.id, -1);
                            }}
                            style={({ pressed }) => [s.stepBtn, pressed && { opacity: 0.6 }]}
                          >
                            <Minus size={20} color={C.textMuted} />
                          </Pressable>

                          <Text style={s.stepVal}>{t.questionsSolved}</Text>

                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation();
                              bump(t.id, 1);
                            }}
                            style={({ pressed }) => [
                              s.stepBtn,
                              s.stepBtnAdd,
                              pressed && { opacity: 0.6 }
                            ]}
                          >
                            <Plus size={20} color={C.white} />
                          </Pressable>
                        </View>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        )}

        {/* RECOVERY DASHBOARD (v1.2.7) */}
        <View style={{ marginTop: 40, padding: 20, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: R.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', marginBottom: 120 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Zap size={18} color={C.accentCyan} />
            <Text style={{ color: C.white, fontSize: 16, fontWeight: '700' }}>R1 Sync Recovery</Text>
          </View>

          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Sync Status:</Text>
              <Text style={{ color: userEmail ? C.accentCyan : 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' }}>
                {userEmail ? 'Authenticated' : 'Guest Mode'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Identity Key:</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontVariant: ['tabular-nums'] }}>{userId?.slice(0, 12)}...</Text>
            </View>
          </View>

          {showRecoveryEntry ? (
            <View style={{ marginTop: 16, gap: 10 }}>
              <TextInput
                style={[s.searchInput, { backgroundColor: 'rgba(255,255,255,0.05)', height: 40, paddingHorizontal: 12 }]}
                placeholder="Paste Recovery ID..."
                placeholderTextColor={C.textMuted}
                value={manualRecoveryID}
                onChangeText={setManualRecoveryID}
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  onPress={() => manualMerge(manualRecoveryID)}
                  style={({ pressed }) => [s.syncBtn, { flex: 1, backgroundColor: C.accentCyan }, pressed && { opacity: 0.7 }]}
                >
                  <Text style={{ color: '#000', fontSize: 13, fontWeight: '700' }}>Confirm Restore</Text>
                </Pressable>
                <Pressable
                  onPress={() => setShowRecoveryEntry(false)}
                  style={({ pressed }) => [s.syncBtn, { backgroundColor: 'rgba(255,255,255,0.05)' }, pressed && { opacity: 0.7 }]}
                >
                  <Text style={{ color: C.white }}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => setShowRecoveryEntry(true)}
              style={({ pressed }) => [s.syncBtn, { marginTop: 16, backgroundColor: 'rgba(255,255,255,0.05)' }, pressed && { opacity: 0.7 }]}
            >
              <RefreshCcw size={16} color={C.white} />
              <Text style={{ color: C.white, fontSize: 13, fontWeight: '700' }}>RESTORE STUDY HISTORY</Text>
            </Pressable>
          )}

          <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, textAlign: 'center', marginTop: 16 }}>Build Production v1.4.2 • Ironclad Sync Stabilization</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.primaryBG },
  blob: {
    position: 'absolute',
    borderRadius: 9999,
    width: 400,
    height: 400,
  },
  blob1: { top: -100, left: -100, backgroundColor: C.accentIndigo },

  scroll: { paddingTop: SPACING.xl, paddingBottom: SPACING.xxxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { marginBottom: SPACING.lg, paddingHorizontal: SPACING.xs },
  headerTop: { flexWrap: 'wrap', gap: 15 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: R.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 15, minWidth: 260, flexGrow: 1, maxWidth: 400 },
  searchIcon: { marginRight: 10 },
  searchClear: { paddingVertical: 10, paddingLeft: 10 },
  searchInput: { height: 44, color: C.white, fontSize: 14, fontWeight: '600', flex: 1 },
  subtitle: { ...TYPOGRAPHY.body, fontSize: 13, marginTop: 4, opacity: 0.5 },

  noResults: { alignItems: 'center', justifyContent: 'center', paddingVertical: 100, width: '100%' },

  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: SPACING.xl },
  examPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: R.xs,
    borderWidth: 1,
    overflow: 'hidden',
  },
  examPillOff: {
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  examPillOn: {
    borderColor: C.accentCyan,
    borderWidth: 2,
    backgroundColor: 'rgba(6,182,212,0.1)'
  },
  examPillTxt: { color: C.textMuted, fontSize: 13, fontWeight: '700' },
  examPillTxtOn: { color: C.white },

  heroCard: {
    backgroundColor: C.surface,
    borderRadius: R.md,
    borderWidth: 1.5,
    borderColor: 'rgba(34, 211, 238, 0.2)',
    padding: SPACING.lg,
    marginBottom: SPACING.xxl,
    overflow: 'hidden',
  },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroTtlRow: { flexDirection: 'row', alignItems: 'center' },
  heroBadge: {
    backgroundColor: '#000',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  badgeTxt: { ...TYPOGRAPHY.meta, color: C.textSecondary, fontSize: 9, letterSpacing: 0.5 },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
    backgroundColor: '#000',
    padding: SPACING.md,
    borderRadius: R.xs,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 12,
  },
  statBox: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  statLbl: {
    ...TYPOGRAPHY.meta,
    marginBottom: 6,
    fontSize: 9,
    opacity: 0.6,
    textAlign: 'center',
  },
  valContainer: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  statVal: { color: C.white, fontSize: 40, fontWeight: '900', textAlign: 'center' },

  pacingWrap: { marginTop: SPACING.md, alignItems: 'center' },
  pacing: { ...TYPOGRAPHY.body, fontSize: 13, opacity: 0.7 },

  barContainer: { marginTop: SPACING.lg },
  barBgHero: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFillHero: { height: 6, borderRadius: 3 },
  pctTxt: {
    color: C.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
    fontWeight: '700',
  },

  secHead: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md, paddingLeft: SPACING.xs },
  sectionLabel: { marginBottom: 0, marginLeft: 8, fontSize: 16, opacity: 0.8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },

  topicCard: {
    backgroundColor: C.surface,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    padding: SPACING.md,
  },
  topicHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  topicMeta: { ...TYPOGRAPHY.meta, fontSize: 9, opacity: 0.4, flex: 1 },
  lodBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  lodTxt: { fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  topicName: { marginBottom: SPACING.md, fontSize: 21, fontWeight: '800', color: C.textPrimary, lineHeight: 28 },

  topicStatLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progValue: { color: C.textSecondary, fontSize: 11, fontWeight: '700' },
  solvedSplit: { color: C.textMuted, fontSize: 11, fontWeight: '600', opacity: 0.5 },

  miniBarBg: { height: 3, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 1.5, marginBottom: SPACING.lg, overflow: 'hidden' },
  miniBarFill: { height: 3, borderRadius: 1.5 },

  syncBtnTxt: {
    color: C.accentCyan,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  syncBtnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(34, 211, 238, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: R.xs,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(34, 211, 238, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: R.sm,
  },

  glassStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: R.xs,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    gap: 12,
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnAdd: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  stepVal: {
    color: C.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    minWidth: 30,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },

  retryBtn: {
    borderRadius: R.sm,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 240,
  },
  retryGradient: {
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  insightCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: R.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: 16,
  },
  insightLabel: {
    ...TYPOGRAPHY.meta,
    fontSize: 9,
    opacity: 0.5,
    letterSpacing: 1,
  },
  insightVal: {
    color: C.white,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 4,
  },
  miniProgress: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 1.5,
    marginTop: 12,
    overflow: 'hidden',
  },
  miniFill: {
    height: '100%',
    borderRadius: 1.5,
  },
});
