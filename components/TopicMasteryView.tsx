import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, R, SPACING, SYLLABUS, pretty } from '@/constants/theme';
import { getTopicStatus } from '@/utils/topicStatus';

interface TopicMasteryViewProps {
  exam: string;
  topics: any[];
  isDesktop: boolean;
}

export function TopicMasteryView({ exam, topics, isDesktop }: TopicMasteryViewProps) {
  const sections = SYLLABUS[exam] || {};
  return (
    <View style={s.topicGrid}>
      {Object.entries(sections).map(([sec, meta]) => {
        const secTopics = topics.filter(t => t.exam === exam && t.section === sec);
        const totalQ = secTopics.reduce((a, t) => a + t.totalQuestions, 0);
        const solved = secTopics.reduce((a, t) => a + t.questionsSolved, 0);
        const mastery = totalQ > 0 ? Math.round((solved / totalQ) * 100) : 0;
        const { status, color: statusColor } = getTopicStatus(mastery);
        return (
          <View key={sec} style={[s.topicMCard, { width: isDesktop ? '48%' : '100%' }]}>
            <Text style={s.topicMWeight}>{meta.weight}% OF EXAM</Text>
            <Text style={s.topicMName}>{pretty(sec)}</Text>
            <Text style={[s.topicMPct, { color: statusColor }]}>{mastery}%</Text>
            <View style={s.topicMBar}>
              <View style={[s.topicMBarFill, { width: `${mastery}%`, backgroundColor: statusColor }]} />
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

const s = StyleSheet.create({
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
});
