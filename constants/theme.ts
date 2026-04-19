import { Platform, TextStyle, ViewStyle } from 'react-native';

/* ── Colors ───────────────────────────────────── */
export const C = {
  primaryBG: '#2C313A', // Obsidian / Muted Charcoal base
  secondaryBG: '#252A33', // Slightly deeper slate for gradient depth
  surface: '#1E293B', // Deep Slate for Cards
  surfaceSoft: '#2D3748',
  surfaceElevated: 'rgba(30, 41, 59, 0.95)',
  border: 'rgba(250, 191, 65, 0.08)', // Faint Gold tint for borders
  borderStrong: 'rgba(250, 191, 65, 0.2)', // Strong Gold tint
  textPrimary: '#F8FAFC',
  textSecondary: '#E2E8F0',
  textMuted: '#94A3B8', 
  accentRed: '#EF4444', 
  accentRedSoft: 'rgba(239, 68, 68, 0.12)',
  accentTeal: '#00E5D1',
  accentTealSoft: 'rgba(0, 229, 209, 0.12)',
  accentBlue: '#FABF41', // Mapped to Champagne Gold for backwards compat
  accentBlueSoft: 'rgba(250, 191, 65, 0.12)',
  accentIndigo: '#FABF41', // Aliased to gold — legacy indigo removed
  accentViolet: '#FABF41', // Aliased to gold — used for tab active tint
  accentCyan: '#22D3EE', 
  accentPink: '#FF00E5', 
  success: '#10B981',
  warning: '#F59E0B',
  white: '#FFFFFF',
} as const;

/* ── Gradients ────────────────────────────────── */
export const GRADIENTS = {
  cta: ['#FACC15', '#FABF41'] as const, // Champagne Gold 
  premiumCTA: ['#FDE047', '#FABF41', '#EAB308'] as const, 
  timerHalo: ['rgba(250, 191, 65, 0.35)', 'rgba(250, 191, 65, 0.15)'] as const, 
  timerRing: ['#FDE047', '#FABF41'] as const, 
  glass: ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.03)'] as const,
};

/* ── Radii ────────────────────────────────────── */
export const R = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
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
  heroTimerMobile: { fontFamily: 'Orbitron_700Bold', fontSize: 60, letterSpacing: 0.5, color: C.textPrimary } as TextStyle,
  heroTimerTablet: { fontFamily: 'Orbitron_700Bold', fontSize: 84, letterSpacing: 1, color: C.textPrimary } as TextStyle,
  screenTitleMobile: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 32, color: C.textPrimary } as TextStyle,
  screenTitleTablet: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 52, color: C.textPrimary } as TextStyle,
  sectionTitle: { fontSize: 18, fontWeight: '700', color: C.textPrimary } as TextStyle,
  cardTitle: { fontSize: 22, fontWeight: '800', color: C.textPrimary } as TextStyle,
  body: { fontSize: 15, lineHeight: 22, color: C.textSecondary } as TextStyle,
  meta: { fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '700', color: C.textMuted } as TextStyle,
  buttonText: { fontSize: 18, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', color: '#0A0A0A' } as TextStyle, // Dark text on gold buttons
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
    shadowColor: '#FF3333',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
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
export const SYLLABUS: Record<string, Record<string, { weight: number, topics: string[] }>> = {
  CFA: {
    Ethical_Professional_Standards: { weight: 17.5, topics: ['Standards of Practice', 'Code of Ethics', 'GIPS'] },
    Financial_Statement_Analysis: { weight: 13, topics: ['Income Statements', 'Balance Sheets', 'Cash Flow Analysis'] },
    Equity_Investments: { weight: 13, topics: ['Market Structure', 'Valuation Concepts', 'Industry Analysis'] },
    Fixed_Income: { weight: 13, topics: ['Bond Valuation', 'Yield Measures', 'Credit Analysis'] },
    Quantitative_Methods: { weight: 8.5, topics: ['Time Value of Money', 'Probability', 'Regression'] },
    Economics: { weight: 8.5, topics: ['Microeconomics', 'Macroeconomics', 'Geopolitics'] },
    Corporate_Issuers: { weight: 8.5, topics: ['Corporate Governance', 'Capital Structure', 'Business Models'] },
    Portfolio_Management: { weight: 5, topics: ['Risk and Return', 'Behavioral Finance', 'Technical Analysis'] },
    Derivatives: { weight: 5, topics: ['Options', 'Forwards and Futures', 'Swaps'] },
    Alternative_Investments: { weight: 5, topics: ['Real Estate', 'Private Equity', 'Hedge Funds'] },
  },
  ATMA: {
    Analytical_Reasoning: { weight: 33.3, topics: ['Coding Decoding', 'Syllogism', 'Blood Relations', 'Arrangements', 'Data Sufficiency'] },
    Verbal_Skills: { weight: 33.3, topics: ['Reading Comprehension', 'Grammar', 'Vocabulary', 'Para Jumbles'] },
    Quantitative_Skills: { weight: 33.3, topics: ['Data Interpretation', 'Arithmetic', 'Algebra', 'Geometry', 'Modern Math'] },
  },
  MAT: {
    Language_Comprehension: { weight: 20, topics: ['Reading Comprehension', 'Sentence Correction', 'Idioms'] },
    Intelligence_Critical_Reasoning: { weight: 20, topics: ['Puzzles', 'Direction Sense', 'Critical Reasoning', 'Input Output'] },
    Mathematical_Skills: { weight: 20, topics: ['Arithmetic', 'Number System', 'Mensuration', 'Probability'] },
    Data_Analysis_Sufficiency: { weight: 20, topics: ['Pie Charts', 'Bar Graphs', 'Data Sufficiency', 'Venn Diagrams'] },
    Indian_Global_Environment: { weight: 20, topics: ['Current Affairs', 'Indian Economy', 'Corporate News'] },
  },
};

export type ExamType = string;
export const EXAM_LIST = Object.keys(SYLLABUS);

export const EXAM_DATES: Record<string, string> = {
  CFA: '2026-05-17',
  ATMA: '2026-05-03',
  MAT: '2026-05-25',
};

export const RATIOS = [1, 15, 25, 52, 90] as const;

export const pretty = (s: string) => s.replace(/_/g, ' ');
