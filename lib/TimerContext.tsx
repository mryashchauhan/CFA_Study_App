import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, ensureAuth } from './supabaseClient';
import { SYLLABUS, ExamType, EXAM_LIST } from '@/constants/theme';

/* ────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────── */
export interface TimerCtx {
  /* auth */
  userId: string | null;
  authReady: boolean;
  /* countdown */
  timeLeft: number;
  isActive: boolean;
  isFinished: boolean;
  ratio: number;
  /* study target */
  exam: ExamType;
  section: string;
  topic: string;
  /* config */
  strictMode: boolean;
  /* active-recall gate */
  recallText: string;
  attemptedThisSession: string;
  correctThisSession: string;
  /* actions */
  setRatio:      (r: number)  => void;
  setExam:       (e: ExamType) => void;
  setSection:    (s: string)  => void;
  setTopic:      (t: string)  => void;
  setStrictMode: (v: boolean) => void;
  setRecallText: (t: string)  => void;
  setAttempted:  (t: string)  => void;
  setCorrect:    (t: string)  => void;
  startTimer:    () => void;
  pauseTimer:    () => void;
  resetTimer:    () => void;
  submitRecall:  () => Promise<void>;
  refreshAuth:   () => void;
}

const Ctx = createContext<TimerCtx | null>(null);

export function useTimer(): TimerCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTimer must be used inside <TimerProvider>');
  return c;
}

/* ────────────────────────────────────────────────────
   Provider
   ──────────────────────────────────────────────────── */
export function TimerProvider({ children }: { children: React.ReactNode }) {
  /* ── auth ─────────────────────────── */
  const [userId, setUserId]       = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  /* ── timer state ──────────────────── */
  const defaultExam    = EXAM_LIST[0];
  const defaultSection = Object.keys(SYLLABUS[defaultExam])[0];
  const defaultTopic   = SYLLABUS[defaultExam][defaultSection].topics[0];

  const [exam, setExamRaw]        = useState<ExamType>(defaultExam);
  const [section, setSectionRaw]  = useState(defaultSection);
  const [topic, setTopicRaw]      = useState(defaultTopic);
  const [ratio, setRatioRaw]      = useState(25);
  const [timeLeft, setTimeLeft]   = useState(25 * 60);
  const [isActive, setIsActive]   = useState(false);
  const [isFinished, setFinished] = useState(false);
  const [strictMode, setStrictRaw]= useState(false);
  const [recallText, setRecall]   = useState('');
  const [attempted, setAttempted] = useState('0');
  const [correct, setCorrect]     = useState('0');

  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncLock  = useRef(false);
  const activeRef = useRef(isActive);
  activeRef.current = isActive;

  /* keep a mutable ref for latest values needed in sync */
  const stateRef = useRef({ ratio, exam, section, topic });
  useEffect(() => {
    stateRef.current = { ratio, exam, section, topic };
  }, [ratio, exam, section, topic]);

  const loadAll = useCallback(async (mounted: boolean) => {
    try {
      const saved = await AsyncStorage.getItem('strictMode');
      if (saved !== null && mounted) setStrictRaw(JSON.parse(saved));
    } catch (e) {
      console.warn('Failed to load strictMode:', e);
    }
    try {
      setAuthReady(false);
      const uid = await ensureAuth();
      if (mounted) {
        setUserId(uid);
        setAuthReady(true);
      }
    } catch (err) {
      console.error('Auth error:', err);
      if (mounted) {
        setUserId(null);
        setAuthReady(true);
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    loadAll(mounted);
    return () => { mounted = false; };
  }, [loadAll]);

  useEffect(() => {
    if (!isActive) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setIsActive(false);
          setFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive]);

  const syncToSupabase = useCallback(
    async (active: boolean, remaining: number) => {
      if (!userId) return;
      syncLock.current = true;
      try {
        const now = new Date();
        const endTime = active ? new Date(now.getTime() + remaining * 1000).toISOString() : null;
        await supabase.from('timer_state').upsert(
          {
            user_id:           userId,
            is_active:         active,
            remaining_seconds: remaining,
            end_time:          endTime,
            duration_seconds:  stateRef.current.ratio * 60,
            exam:              stateRef.current.exam,
            section:           stateRef.current.section,
            topic:             stateRef.current.topic,
            updated_at:        now.toISOString(),
          },
          { onConflict: 'user_id' },
        );
      } catch (err) {
        console.error('Timer sync error:', err);
      }
      setTimeout(() => { syncLock.current = false; }, 1200);
    },
    [userId],
  );

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('timer_state')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (data) {
          syncLock.current = true;
          if (data.is_active && data.end_time) {
            const rem = Math.max(0, Math.round((new Date(data.end_time).getTime() - Date.now()) / 1000));
            if (rem > 0) {
              setTimeLeft(rem);
              setIsActive(true);
            } else {
              setTimeLeft(0);
              setIsActive(false);
              setFinished(true);
            }
          } else {
            setTimeLeft(data.remaining_seconds ?? data.duration_seconds ?? 1500);
            setIsActive(false);
          }
          if (data.duration_seconds) setRatioRaw(Math.round(data.duration_seconds / 60));
          if (data.exam)    setExamRaw(data.exam);
          if (data.section) setSectionRaw(data.section);
          if (data.topic)   setTopicRaw(data.topic);
          setTimeout(() => { syncLock.current = false; }, 600);
        }
      } catch (error) {
        console.warn('Supabase sync failed (timer initial):', error);
      }
    })();

    const channel = supabase
      .channel('timer-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'timer_state', filter: `user_id=eq.${userId}` },
        payload => {
          if (syncLock.current) return;
          const d = payload.new as any;
          if (!d) return;
          syncLock.current = true;
          if (d.is_active && d.end_time) {
            const rem = Math.max(0, Math.round((new Date(d.end_time).getTime() - Date.now()) / 1000));
            if (rem > 0) {
              setTimeLeft(rem);
              setIsActive(true);
              setFinished(false);
            } else {
              setTimeLeft(0);
              setIsActive(false);
              setFinished(true);
            }
          } else {
            if (timerRef.current) clearInterval(timerRef.current);
            setTimeLeft(d.remaining_seconds ?? 1500);
            setIsActive(false);
          }
          if (d.duration_seconds) setRatioRaw(Math.round(d.duration_seconds / 60));
          if (d.exam)    setExamRaw(d.exam);
          if (d.section) setSectionRaw(d.section);
          if (d.topic)   setTopicRaw(d.topic);
          setTimeout(() => { syncLock.current = false; }, 800);
        },
      ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  useEffect(() => {
    const handle = (next: AppStateStatus) => {
      if (next !== 'active' && activeRef.current && strictMode) {
        if (timerRef.current) clearInterval(timerRef.current);
        const resetVal = stateRef.current.ratio * 60;
        setIsActive(false);
        setTimeLeft(resetVal);
        syncToSupabase(false, resetVal);
        if (Platform.OS === 'web') {
          (typeof alert !== 'undefined') && alert('Strict Mode Violation! Session failed.');
        } else {
          Alert.alert('Strict Mode', 'You left the app. Session failed.');
        }
      }
    };
    const sub = AppState.addEventListener('change', handle);
    return () => sub.remove();
  }, [strictMode, syncToSupabase]);

  const startTimer = useCallback(() => {
    setIsActive(true);
    setFinished(false);
    setTimeLeft(prev => {
      syncToSupabase(true, prev);
      return prev;
    });
  }, [syncToSupabase]);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsActive(false);
    setTimeLeft(prev => {
      syncToSupabase(false, prev);
      return prev;
    });
  }, [syncToSupabase]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsActive(false);
    setFinished(false);
    const newTime = stateRef.current.ratio * 60;
    setTimeLeft(newTime);
    syncToSupabase(false, newTime);
  }, [syncToSupabase]);

  const setRatio = useCallback(
    (r: number) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsActive(false);
      setFinished(false);
      setRatioRaw(r);
      setTimeLeft(r * 60);
      syncToSupabase(false, r * 60);
    },
    [syncToSupabase],
  );

  const setExam = useCallback((e: ExamType) => {
    setExamRaw(e);
    const firstSec = Object.keys(SYLLABUS[e])[0];
    setSectionRaw(firstSec);
    setTopicRaw(SYLLABUS[e][firstSec].topics[0]);
  }, []);

  const setSection = useCallback(
    (s: string) => {
      setSectionRaw(s);
      setTopicRaw(SYLLABUS[exam][s].topics[0]);
    },
    [exam],
  );

  const setTopic = useCallback((t: string) => setTopicRaw(t), []);

  const submitRecall = useCallback(async () => {
    if (!userId) return;
    const attCount = parseInt(attempted, 10) || 0;
    const corCount = parseInt(correct, 10) || 0;
    const sessionSeconds = (stateRef.current.ratio * 60) - timeLeft;

    try {
      // Fetch core topic for diagnostic update
      const { data: topicRow } = await supabase
        .from('topics')
        .select('*')
        .eq('user_id', userId)
        .eq('exam', stateRef.current.exam)
        .eq('section', stateRef.current.section)
        .eq('topic', stateRef.current.topic)
        .maybeSingle();

      if (topicRow) {
        const newSolved = (topicRow.questionsSolved || 0) + attCount;
        const newCorrect = (topicRow.questions_correct || 0) + corCount;
        const oldTotalTime = (topicRow.avg_time_per_question || 0) * (topicRow.questionsSolved || 0);
        const newTotalTime = oldTotalTime + sessionSeconds;
        const newAvgTime = newSolved > 0 ? newTotalTime / newSolved : 0;

        await supabase.from('topics').update({
          questionsSolved: newSolved,
          questions_correct: newCorrect,
          avg_time_per_question: newAvgTime,
          revision_count: (topicRow.revision_count || 0) + 1,
          updated_at: new Date().toISOString(),
        }).eq('id', topicRow.id);
      }
    } catch (e) {
      console.warn('Diagnostic update failed:', e);
    }

    setFinished(false);
    setRecall('');
    setAttempted('0');
    setCorrect('0');
    const newTime = stateRef.current.ratio * 60;
    setTimeLeft(newTime);
    syncToSupabase(false, newTime);
  }, [userId, attempted, correct, recallText, syncToSupabase, timeLeft]);

  return (
    <Ctx.Provider
      value={{
        userId, authReady, timeLeft, isActive, isFinished, ratio, exam, section, topic,
        strictMode, recallText, attemptedThisSession: attempted, correctThisSession: correct,
        setRatio, setExam, setSection, setTopic, setRecallText: setRecall, setAttempted, setCorrect,
        setStrictMode: async (v: boolean) => {
          setStrictRaw(v);
          try { await AsyncStorage.setItem('strictMode', JSON.stringify(v)); } catch (e) {}
        },
        startTimer, pauseTimer, resetTimer, submitRecall, refreshAuth: () => loadAll(true),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
