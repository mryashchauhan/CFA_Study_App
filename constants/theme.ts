import { Platform, TextStyle, ViewStyle } from 'react-native';

/* ── Colors ───────────────────────────────────── */
export const C = {
  primaryBG: '#02040C', // Deep Night Navy (Inky AMOLED)
  secondaryBG: '#050812', // Subtle Depth
  surface: '#0D111A', // Richer Dark Surface
  surfaceSoft: '#121724',
  surfaceElevated: 'rgba(30, 36, 50, 0.95)',
  border: 'rgba(255, 255, 255, 0.18)', // Higher luster
  borderStrong: 'rgba(255, 255, 255, 0.28)',
  textPrimary: '#F8FAFC',
  textSecondary: '#E2E8F0',
  textMuted: '#94A3B8', 
  accentRed: '#FF3333', // More saturated
  accentRedSoft: 'rgba(255, 51, 51, 0.12)',
  accentTeal: '#00E5D1',
  accentTealSoft: 'rgba(0, 229, 209, 0.12)',
  accentBlue: '#00B4FF',
  accentBlueSoft: 'rgba(0, 180, 255, 0.12)',
  accentIndigo: '#4D4DFF', // Pure Electric Indigo
  accentViolet: '#8B5CF6',
  accentCyan: '#00F2FF', // Max Neon Cyan
  accentPink: '#FF00E5', // Neon Pink
  success: '#00FF99',
  warning: '#FFB800',
  white: '#FFFFFF',
} as const;

/* ── Gradients ────────────────────────────────── */
export const GRADIENTS = {
  cta: ['#4D4DFF', '#312E81'] as const, // Pure Indigo suite
  premiumCTA: ['#00F2FF', '#4D4DFF', '#2D1B69'] as const, // Neon Cyan -> Royal Indigo -> Deep Violet
  timerHalo: ['rgba(0, 242, 255, 0.35)', 'rgba(77, 77, 255, 0.15)'] as const, 
  timerRing: ['#00F2FF', '#4D4DFF'] as const, // Neon Cyan -> Indigo
  glass: ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.03)'] as const,
};

/* ── Radii ────────────────────────────────────── */
export const R = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24, // Sharper feel  xl: 32,
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
  heroTimerMobile: { fontSize: 60, fontWeight: '800', letterSpacing: 0.5, color: C.textPrimary } as TextStyle,
  heroTimerTablet: { fontSize: 84, fontWeight: '800', letterSpacing: 1, color: C.textPrimary } as TextStyle,
  screenTitleMobile: { fontSize: 32, fontWeight: '800', color: C.textPrimary } as TextStyle,
  screenTitleTablet: { fontSize: 40, fontWeight: '800', color: C.textPrimary } as TextStyle,
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
    Ethical_Professional_Standards: ['Standards of Practice', 'Code of Ethics', 'GIPS'],
    Quantitative_Methods:           ['Time Value of Money', 'Probability', 'Regression'],
    Economics:                      ['Microeconomics', 'Macroeconomics', 'Geopolitics'],
    Corporate_Issuers:              ['Corporate Governance', 'Capital Structure', 'Business Models'],
    Financial_Statement_Analysis:   ['Income Statements', 'Balance Sheets', 'Cash Flow Analysis'],
    Equity_Investments:             ['Market Structure', 'Valuation Concepts', 'Industry Analysis'],
    Fixed_Income:                   ['Bond Valuation', 'Yield Measures', 'Credit Analysis'],
    Derivatives:                    ['Options', 'Forwards and Futures', 'Swaps'],
    Alternative_Investments:        ['Real Estate', 'Private Equity', 'Hedge Funds'],
    Portfolio_Management:           ['Risk and Return', 'Behavioral Finance', 'Technical Analysis'],
  },
  ATMA: {
    Analytical_Reasoning: ['Coding Decoding', 'Syllogism', 'Blood Relations', 'Arrangements', 'Data Sufficiency'],
    Verbal_Skills:        ['Reading Comprehension', 'Grammar', 'Vocabulary', 'Para Jumbles'],
    Quantitative_Skills:  ['Data Interpretation', 'Arithmetic', 'Algebra', 'Geometry', 'Modern Math'],
  },
  MAT: {
    Language_Comprehension:          ['Reading Comprehension', 'Sentence Correction', 'Idioms'],
    Intelligence_Critical_Reasoning: ['Puzzles', 'Direction Sense', 'Critical Reasoning', 'Input Output'],
    Mathematical_Skills:             ['Arithmetic', 'Number System', 'Mensuration', 'Probability'],
    Data_Analysis_Sufficiency:       ['Pie Charts', 'Bar Graphs', 'Data Sufficiency', 'Venn Diagrams'],
    Indian_Global_Environment:       ['Current Affairs', 'Indian Economy', 'Corporate News'],
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
