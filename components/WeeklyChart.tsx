import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { C, R } from '@/constants/theme';

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

interface WeeklyChartProps {
  sessions: FocusSession[];
}

export function WeeklyChart({ sessions }: WeeklyChartProps) {
  const { width } = useWindowDimensions();

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

  return (
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
  );
}

const s = StyleSheet.create({
  chartCard: { backgroundColor: C.surface, borderRadius: R.md, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', marginBottom: 24 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  chartKicker: { fontSize: 9, color: C.textMuted, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4 },
  chartTitle: { fontSize: 16, color: C.white, fontWeight: '800' },
  chartLegend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 2, backgroundColor: C.accentCyan },
  legendTxt: { fontSize: 11, color: C.textMuted, fontWeight: '600' },
});
