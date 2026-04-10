import { Platform, TextStyle, ViewStyle } from 'react-native';

/* ── Colors ───────────────────────────────────── */
export const C = {
  primaryBG: '#0A0D14',
  secondaryBG: '#0F131B',
  surface: 'rgba(20, 24, 32, 0.88)',
  surfaceSoft: 'rgba(28, 33, 43, 0.72)',
  surfaceElevated: 'rgba(24, 28, 38, 0.96)',
  border: 'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.12)',
  textPrimary: '#F5F7FB',
  textSecondary: '#A7B0BE',
  textMuted: '#7F8795',
  accentRed: '#FF3B30',
  accentRedSoft: 'rgba(255,59,48,0.16)',
  accentTeal: '#4FD1C5',
  accentTealSoft: 'rgba(79,209,197,0.18)',
  accentBlue: '#7CC7FF',
  accentBlueSoft: 'rgba(124,199,255,0.16)',
  success: '#34D399',
  warning: '#FBBF24',
  white: '#FFFFFF',
} as const;

/* ── Gradients ────────────────────────────────── */
export const GRADIENTS = {
  cta: ['#FF5147', '#CC2E1F'] as const,
};

/* ── Radii ────────────────────────────────────── */
export const R = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 28,
  xl: 32,
  pill: 999,
} as const;

/* ── Spacing ──────────────────────────────────── */
export const SPACING = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 56,
} as const;

/* ── Typography ───────────────────────────────── */
export const TYPOGRAPHY = {
  heroTimerMobile: { fontSize: 72, fontWeight: '800', letterSpacing: 1.5, color: C.accentRed } as TextStyle,
  heroTimerTablet: { fontSize: 84, fontWeight: '800', letterSpacing: 1.5, color: C.accentRed } as TextStyle,
  screenTitleMobile: { fontSize: 34, fontWeight: '800', color: C.textPrimary } as TextStyle,
  screenTitleTablet: { fontSize: 42, fontWeight: '800', color: C.textPrimary } as TextStyle,
  sectionTitle: { fontSize: 18, fontWeight: '700', color: C.textPrimary } as TextStyle,
  cardTitle: { fontSize: 22, fontWeight: '800', color: C.textPrimary } as TextStyle,
  body: { fontSize: 15, lineHeight: 22, color: C.textSecondary } as TextStyle,
  meta: { fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '700', color: C.textMuted } as TextStyle,
  buttonText: { fontSize: 18, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', color: C.white } as TextStyle,
} as const;

/* ── Shadow Tokens ────────────────────────────── */
export const SHADOWS = {
  shadowGlass: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 28,
    elevation: 12,
  } as ViewStyle,
  shadowSoft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  } as ViewStyle,
  glowTeal: {
    shadowColor: C.accentTeal,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 10,
  } as ViewStyle,
  glowRed: {
    shadowColor: '#FF5147',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 14,
  } as ViewStyle,
} as const;

/* ── Cross-platform glow / shadow adapter ─────── */
export function glow(color: string, radius: number): Record<string, any> {
  return Platform.select({
    web: { boxShadow: `0 0 ${radius}px ${color}` } as any,
    default: {
      shadowColor: color,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: radius,
      elevation: Math.round(radius / 2),
    },
  }) as Record<string, any>;
}

/* ── Syllabus Data ────────────────────────────── */
export const SYLLABUS: Record<string, Record<string, string[]>> = {
  CFA: {
    Ethics:               ['Standards of Practice', 'Code of Ethics', 'GIPS'],
    Quantitative_Methods: ['Time Value of Money', 'Probability', 'Regression'],
    Economics:            ['Microeconomics', 'Macroeconomics', 'Geopolitics'],
    Corporate_Issuers:    ['Corporate Governance', 'Capital Structure', 'Business Models'],
    FSA:                  ['Income Statements', 'Balance Sheets', 'Cash Flow Analysis'],
    Equity:               ['Market Structure', 'Valuation Concepts', 'Industry Analysis'],
    Fixed_Income:         ['Bond Valuation', 'Yield Measures', 'Credit Analysis'],
    Derivatives:          ['Options', 'Forwards and Futures', 'Swaps'],
    Alternatives:         ['Real Estate', 'Private Equity', 'Hedge Funds'],
    Portfolio_Management: ['Risk and Return', 'Behavioral Finance', 'Technical Analysis'],
  },
  ATMA: {
    Analytical_Reasoning: ['Coding Decoding', 'Syllogism', 'Blood Relations', 'Arrangements', 'Data Sufficiency'],
    Verbal_Skills:        ['Reading Comprehension', 'Grammar', 'Vocabulary', 'Para Jumbles'],
    Quantitative_Skills:  ['Data Interpretation', 'Arithmetic', 'Algebra', 'Geometry', 'Modern Math'],
  },
  MAT: {
    Language_Comprehension:  ['Reading Comprehension', 'Sentence Correction', 'Idioms'],
    Intelligence_Reasoning:  ['Puzzles', 'Direction Sense', 'Critical Reasoning', 'Input Output'],
    Mathematical_Skills:     ['Arithmetic', 'Number System', 'Mensuration', 'Probability'],
    Data_Analysis:           ['Pie Charts', 'Bar Graphs', 'Data Sufficiency', 'Venn Diagrams'],
    Global_Environment:      ['Current Affairs', 'Indian Economy', 'Corporate News'],
  },
};

export type ExamType = string;
export const EXAM_LIST = Object.keys(SYLLABUS);

export const EXAM_DATES: Record<string, string> = {
  CFA:  '2026-05-17',
  ATMA: '2026-05-03',
  MAT:  '2026-05-25',
};

export const RATIOS = [1, 15, 25, 52, 90] as const;

export const pretty = (s: string) => s.replace(/_/g, ' ');
