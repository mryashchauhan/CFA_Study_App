import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { C, SYLLABUS, pretty } from '@/constants/theme';

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

interface StudyHeatmapProps {
  sessions: FocusSession[];
  exam: string;
  width: number;
}

export function StudyHeatmap({ sessions, exam, width }: StudyHeatmapProps) {
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

const s = StyleSheet.create({
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
