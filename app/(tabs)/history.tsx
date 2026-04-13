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
  ChevronRight
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
  const { userId, authReady } = useTimer();
  const { width } = useWindowDimensions();
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [loading, setLoading] = useState(true);

  const isDesktop = width >= 768;
  const CONTENT_MAX_W = 1000;

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
          <View>
            <Text style={TYPOGRAPHY.screenTitleMobile}>Study Log</Text>
            <Text style={[TYPOGRAPHY.body, { opacity: 0.5 }]}>Historical focus & retention data</Text>
          </View>
        </View>

        {sessions.length === 0 ? (
          <View style={s.emptyState}>
            <Clock size={48} color={C.textMuted} style={{ opacity: 0.2, marginBottom: 16 }} />
            <Text style={[TYPOGRAPHY.sectionTitle, { color: C.white, opacity: 0.4 }]}>No Sessions Yet</Text>
            <Text style={[TYPOGRAPHY.body, { opacity: 0.3, textAlign: 'center', marginTop: 8 }]}>
              Start a Focus session to begin logging your progress.
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
        
        {sessions.length > 0 && (
          <Text style={s.footerNote}>Showing last 50 sessions</Text>
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
    paddingVertical: 100,
    alignItems: 'center',
    justifyContent: 'center',
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
  }
});
