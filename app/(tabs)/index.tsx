import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
  Pressable,
  Platform,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Award,
  Clock,
  Plus,
  Minus,
  Zap,
  LayoutDashboard,
  Target,
  Calendar,
  Layers,
  Search,
  Bell,
  ChevronRight,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabaseClient';
import { useTimer } from '@/lib/TimerContext';
import {
  C,
  SPACING,
  TYPOGRAPHY,
  SYLLABUS,
  EXAM_LIST,
  EXAM_DATES,
  ExamType,
  pretty,
  SHADOWS,
  R,
  glow,
} from '@/constants/theme';

const TARGETS: Record<string, number> = {
  'Ethical and Professional Standards': 180,
  'Financial Statement Analysis': 156,
  'Equity Investments': 156,
  'Fixed Income': 156,
  'Quantitative Methods': 102,
  'Economics': 102,
  'Corporate Issuers': 102,
  'Portfolio Management': 60,
  'Derivatives': 60,
  'Alternative Investments': 60,
};

async function seedTopics(uid: string, exam: ExamType) {
  const sections = SYLLABUS[exam];
  if (!sections) return;
  const rows = Object.entries(sections).flatMap(([section, data]) =>
    data.topics.map((topic) => ({
      user_id: uid,
      exam,
      section,
      topic,
      questionsSolved: 0,
      questions_correct: 0,
      topic_weight: data.weight || 0,
      avg_time_per_question: 0,
      lod: 'Medium',
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
  const [searchQuery, setSearchQuery] = useState('');

  const isDesktop = width > 900;
  const isTablet = width > 600;

  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    let { data } = await supabase
      .from('topics')
      .select('*')
      .eq('user_id', userId)
      .eq('exam', selectedExam);

    if (!data || data.length === 0) {
      await seedTopics(userId, selectedExam);
      const { data: s } = await supabase
        .from('topics')
        .select('*')
        .eq('user_id', userId)
        .eq('exam', selectedExam);
      data = s;
    }
    setTopics(data || []);
    setLoading(false);
  }, [userId, selectedExam]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const bump = async (id: string, delta: number, current: number, target: number) => {
    const val = Math.max(0, Math.min(target, current + delta));
    setTopics((prev) => prev.map((t) => (t.id === id ? { ...t, questionsSolved: val } : t)));
    await supabase.from('topics').update({ questionsSolved: val }).eq('id', id);
  };

  const setDifficulty = async (id: string, level: string) => {
    setTopics((prev) => prev.map((t) => (t.id === id ? { ...t, lod: level } : t)));
    await supabase.from('topics').update({ lod: level }).eq('id', id);
  };

  const setTarget = async (id: string, target: number) => {
    const val = Math.max(1, target);
    setTopics((prev) => prev.map((t) => (t.id === id ? { ...t, totalQuestions: val } : t)));
    await supabase.from('topics').update({ totalQuestions: val }).eq('id', id);
  };

  const processed = useMemo(() => {
    return topics
      .map((t) => {
        // Use DB totalQuestions if > 0, otherwise fall back to syllabus TARGETS
        const target = t.totalQuestions > 0 ? t.totalQuestions : (selectedExam === 'CFA' ? TARGETS[t.section] : 100) || 100;
        const acc = t.questionsSolved > 0 ? (t.questions_correct / t.questionsSolved) * 100 : 0;
        return { ...t, acc, target, prio: (t.topic_weight || 0) * (1 - acc / 100) };
      })
      .filter(t => 
        t.topic.toLowerCase().includes(searchQuery.toLowerCase()) || 
        t.section.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => b.prio - a.prio);
  }, [topics, selectedExam, searchQuery]);

  const stats = useMemo(() => {
    const solved = topics.reduce((s, t) => s + (t.questionsSolved || 0), 0);
    const correct = topics.reduce((s, t) => s + (t.questions_correct || 0), 0);
    const acc = solved > 0 ? (correct / solved * 100).toFixed(1) : '0.0';
    const days = Math.max(
      1,
      Math.ceil(
        (new Date(EXAM_DATES[selectedExam] || Date.now()).getTime() - Date.now()) / 86400000
      )
    );
    const totalTarget = topics.reduce((s, t) => {
      const target = t.totalQuestions > 0 ? t.totalQuestions : (selectedExam === 'CFA' ? TARGETS[t.section] : 100) || 100;
      return s + target;
    }, 0);
    const totalProg = totalTarget > 0 ? (solved / totalTarget) * 100 : 0;

    return { acc, pace: ((totalTarget - solved) / days).toFixed(1), days, progress: totalProg };
  }, [topics, selectedExam]);

  if (!authReady || loading)
    return (
      <View style={s.center}>
        <ActivityIndicator color={C.accentCyan} size='large' />
      </View>
    );

  return (
    <View style={s.root}>
      <LinearGradient colors={['#05070A', '#0D0F14']} style={StyleSheet.absoluteFillObject} />

      {/* Layout Container */}
      <View style={s.layoutContainer}>
        {/* Main Content Area */}
        <View style={s.mainContent}>
          <ScrollView
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
            stickyHeaderIndices={[0]}
          >
            {/* Top Bar Switcher */}
            <View style={s.topHeader}>
              <View style={s.topSearchRow}>
                <View>
                  <Text style={s.greeting}>Welcome back,</Text>
                  <Text style={s.mainTitle}>Overview</Text>
                </View>
                <View style={s.headerIcons}>
                  <View style={s.searchContainer}>
                    <Search size={18} color={C.textMuted} style={s.searchIcon} />
                    <TextInput
                      style={s.searchInput}
                      placeholder="Search topics..."
                      placeholderTextColor={C.textMuted}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                  </View>
                  <Pressable style={s.iconBtn}>
                    <Bell size={22} color={C.textMuted} />
                  </Pressable>
                </View>
              </View>

              <View style={s.pillRow}>
                {EXAM_LIST.map((e) => (
                  <Pressable
                    key={e}
                    onPress={() => setSelectedExam(e)}
                    style={[s.pill, e === selectedExam && s.pillOn]}
                  >
                    <Text style={[s.pillTxt, e === selectedExam && s.pillTxtOn]}>{e}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Dribbble Style Hero Card */}
            <View style={s.heroWrapper}>
              <LinearGradient
                colors={['#1F2937', '#111827']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.heroCard}
              >
                <View style={s.heroMainContent}>
                  <Text style={s.heroCategory}>{selectedExam} MASTER CLASS</Text>
                  <Text style={[s.heroHeading, { fontSize: isDesktop ? 42 : 32, lineHeight: isDesktop ? 50 : 40 }]}>
                    {selectedExam === 'CFA'
                      ? 'Investment Analysis Mastery'
                      : 'Analytical Intelligence'}
                  </Text>
                  <Text style={s.heroSub}>
                    Focus on High-Priority topics to maximize your {stats.acc}% accuracy.
                  </Text>

                  <View style={s.heroStatsRow}>
                    <View style={s.heroStatChip}>
                      <Clock size={14} color={C.accentCyan} />
                      <Text style={s.heroStatText}>{stats.days} days</Text>
                    </View>
                    <View style={s.heroStatChip}>
                      <Layers size={14} color={C.accentCyan} />
                      <Text style={s.heroStatText}>{topics.length} Sections</Text>
                    </View>
                  </View>

                  <View style={s.heroProgressGroup}>
                    <View style={s.heroMetricRow}>
                      <View>
                         <Text style={s.metricLabel}>OVERALL MASTERY</Text>
                         <Text style={s.progValue}>{stats.progress.toFixed(0)}%</Text>
                      </View>
                      <View style={s.metricDivider} />
                      <View>
                         <Text style={s.metricLabel}>ACCURACY</Text>
                         <Text style={s.progValue}>{stats.acc}%</Text>
                      </View>
                    </View>
                    <View style={s.heroPaceRow}>
                      <Text style={s.paceLabel}>SUGGESTED PACE: <Text style={s.paceValue}>{stats.pace} Qs / Day</Text></Text>
                    </View>
                  </View>
                </View>

                {/* Accent Glow */}
                <View style={[s.heroGlow, { backgroundColor: C.accentIndigo }]} />
              </LinearGradient>
            </View>

            {/* Topics Section */}
            <View style={s.syllabusSection}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Syllabus Priority</Text>
                <Pressable>
                  <Text style={s.viewAll}>View all</Text>
                </Pressable>
              </View>

              <View style={s.topicsGrid}>
                {processed.map((t) => {
                  const needsReview = t.acc < 70 && t.questionsSolved > 0;
                  return (
                    <View
                      key={t.id}
                      style={[
                        s.topicCard,
                        { width: isDesktop ? '31.5%' : isTablet ? '48%' : '100%' },
                      ]}
                    >
                      <View style={s.cardTop}>
                        <View
                          style={[
                            s.iconSquare,
                            { backgroundColor: needsReview ? C.accentRedSoft : C.accentBlueSoft },
                          ]}
                        >
                          <Zap size={20} color={needsReview ? C.accentRed : C.accentCyan} />
                        </View>

                        {/* DIFFICULTY SELECTOR */}
                        <View style={s.difficultyPicker}>
                          {[
                            { l: 'B', v: 'Easy' },
                            { l: 'I', v: 'Medium' },
                            { l: 'M', v: 'Hard' }
                          ].map((lvl) => {
                            const active = t.lod === lvl.v;
                            return (
                              <Pressable
                                key={lvl.v}
                                onPress={() => setDifficulty(t.id, lvl.v)}
                                style={[s.diffPill, active && s.diffPillOn]}
                              >
                                <Text style={[s.diffTxt, active && s.diffTxtOn]}>{lvl.l}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>

                      <Text style={s.topicTitle} numberOfLines={2}>
                        {t.topic}
                      </Text>
                      <Text style={s.topicMeta}>{pretty(t.section)}</Text>

                      <View style={s.cardBody}>
                        <View style={s.cardStatRow}>
                          <View style={s.cardStat}>
                            <Award size={14} color={t.acc >= 70 ? C.success : C.accentRed} />
                            <Text
                              style={[
                                s.cardStatVal,
                                { color: t.acc >= 70 ? C.success : C.accentRed },
                              ]}
                            >
                              {t.acc.toFixed(0)}%
                            </Text>
                          </View>
                          <View style={s.cardStat}>
                            <Target size={14} color={C.textMuted} />
                            <Text style={s.cardStatVal}>{t.topic_weight}%</Text>
                          </View>
                        </View>

                        <View style={s.progressRow}>
                          <View style={s.miniBarBg}>
                            <View
                              style={[
                                s.miniBarFill,
                                {
                                  width: `${Math.min(100, (t.questionsSolved / t.target) * 100)}%`,
                                  backgroundColor: needsReview ? C.accentRed : C.accentCyan,
                                },
                              ]}
                            />
                          </View>
                          <View style={s.targetEditor}>
                             <Pressable onPress={() => setTarget(t.id, t.target - 5)}><Minus size={12} color={C.textMuted} /></Pressable>
                             <Text style={s.countLabel}>{t.questionsSolved}/{t.target}</Text>
                             <Pressable onPress={() => setTarget(t.id, t.target + 5)}><Plus size={12} color={C.textMuted} /></Pressable>
                          </View>
                        </View>
                      </View>

                      {/* TACTILE CONTROLS */}
                      <View style={s.tactileControls}>
                        <Pressable
                          onPress={() => bump(t.id, -1, t.questionsSolved, t.target)}
                          style={s.tactileBtn}
                        >
                          <Minus size={18} color={C.textMuted} />
                        </Pressable>
                        <Text style={s.tactileVal}>{t.questionsSolved}</Text>
                        <Pressable
                          onPress={() => bump(t.id, 1, t.questionsSolved, t.target)}
                          style={s.tactileBtn}
                        >
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
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05070A' },
  layoutContainer: { flex: 1, flexDirection: 'row' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  /* Sidebar Styles */
  sidebar: {
    width: 80,
    backgroundColor: '#0D111A',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    paddingVertical: 30,
  },
  sideLogo: { marginBottom: 50 },
  logoCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 242, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 255, 0.2)',
  },
  sideNav: { gap: 30 },
  sideItem: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sideItemActive: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Main Content Styles */
  mainContent: { flex: 1 },
  scroll: { paddingBottom: 100 },

  topHeader: {
    paddingHorizontal: SPACING.xl,
    paddingTop: 40,
    paddingBottom: 20,
    backgroundColor: '#05070A',
  },
  topSearchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '500', letterSpacing: 0.5 },
  mainTitle: { color: C.white, fontSize: 34, fontWeight: '900', marginTop: 4 },
  headerIcons: { flexDirection: 'row', gap: 12 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  pillRow: { flexDirection: 'row', gap: 12 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  pillOn: {
    borderColor: C.accentCyan,
    backgroundColor: 'rgba(0,242,255,0.05)',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    paddingHorizontal: 16,
    width: 300,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchIcon: { marginRight: 10 },
  searchInput: {
    flex: 1,
    height: 44,
    color: C.white,
    fontSize: 14,
    fontWeight: '600',
  },
  pillTxt: { color: C.textMuted, fontSize: 13, fontWeight: '700' },
  pillTxtOn: { color: C.white },

  /* Hero Card Styles */
  heroWrapper: {
    paddingHorizontal: SPACING.xl,
    marginVertical: 48,
  },
  heroCard: {
    borderRadius: 28,
    padding: 44,
    minHeight: 280,
    overflow: 'hidden',
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    ...SHADOWS.shadowSoft,
  },
  heroMainContent: { flex: 1, zIndex: 10 },
  heroCategory: { color: C.accentCyan, fontSize: 13, fontWeight: '900', letterSpacing: 1.8 },
  heroHeading: {
    color: C.white,
    fontWeight: '900',
    marginTop: 14,
  },
  heroSub: { color: 'rgba(255,255,255,0.4)', fontSize: 16, marginTop: 16, maxWidth: 500, lineHeight: 24 },
  heroStatsRow: { flexDirection: 'row', gap: 16, marginTop: 24 },
  heroStatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  heroStatText: { color: C.white, fontSize: 14, fontWeight: '800' },
  heroProgressGroup: { marginTop: 40 },
  heroMetricRow: { flexDirection: 'row', alignItems: 'center', gap: 32 },
  metricLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
  metricDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.1)' },
  progValue: { color: C.white, fontSize: 36, fontWeight: '900' },
  heroPaceRow: { marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', maxWidth: 300 },
  paceLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: '600' },
  paceValue: { color: C.white, fontWeight: '800' },
  heroGlow: {
    position: 'absolute',
    right: -100,
    top: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.15,
    ...glow(C.accentIndigo, 100),
  },

  /* Topics Grid */
  syllabusSection: { paddingHorizontal: SPACING.xl },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  sectionTitle: { color: C.white, fontSize: 26, fontWeight: '900' },
  viewAll: { color: C.accentCyan, fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  topicsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 32 },
  
  /* Topic Card Styles */
  topicCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 28,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    ...SHADOWS.shadowSoft,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconSquare: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  difficultyPicker: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  diffPill: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diffPillOn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  diffTxt: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '900' },
  diffTxtOn: { color: C.accentCyan },

  topicTitle: { color: C.white, fontSize: 19, fontWeight: '800', lineHeight: 26 },
  topicMeta: { color: 'rgba(255,255,255,0.3)', fontSize: 13, fontWeight: '600', marginTop: 4 },

  cardBody: { marginVertical: 20 },
  cardStatRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  cardStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardStatVal: { color: C.textMuted, fontSize: 13, fontWeight: '700' },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  miniBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  miniBarFill: { height: '100%', borderRadius: 3 },
  targetEditor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  countLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },

  tactileControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  tactileBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tactileVal: { color: C.white, fontSize: 18, fontWeight: '900' },
});
