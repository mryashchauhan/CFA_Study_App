import { EXAM_LIST, ExamType, SYLLABUS } from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Alert, AppState, AppStateStatus, Platform, Share } from 'react-native';
import { ensureAuth, generateSyncUrl, supabase } from './supabaseClient';

/* ────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────── */
export interface TopicRecord {
  id: string;
  user_id: string;
  exam: string;
  section: string;
  topic: string;
  questionsSolved: number;
  totalQuestions: number;
  lod: 'Easy' | 'Medium' | 'Hard';
  created_at: string;
  updated_at: string;
}

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
  setRatio: (r: number) => void;
  setExam: (e: ExamType) => void;
  setSection: (s: string) => void;
  setTopic: (t: string) => void;
  setStrictMode: (v: boolean) => Promise<void>;
  setRecallText: (t: string) => void;
  setAttempted: (t: string) => void;
  setCorrect: (t: string) => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  submitRecall: () => Promise<void>;
  refreshAuth: () => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  forceMerge: () => Promise<void>;
  manualMerge: (oldId: string) => Promise<void>;
  resetSyllabus: () => Promise<void>;
  userEmail: string | null;
  topics: TopicRecord[];
}

const Ctx = createContext<TimerCtx | null>(null);

export function useTimer(): TimerCtx {
  const c = useContext(Ctx);
  if (!c) {
    throw new Error("useTimer must be used within a TimerProvider");
  }
  return c;
}

/* ────────────────────────────────────────────────────
   Syllabus Seeding (Automated v1.5.0)
   ──────────────────────────────────────────────────── */
async function seedTopics(uid: string, examKey: ExamType) {
  try {
    const sections = SYLLABUS[examKey];
    if (!sections) return;
    const rows = Object.entries(sections).flatMap(([section, sectionData]) =>
      sectionData.topics.map(topic => ({
        user_id: uid,
        exam: examKey,
        section,
        topic,
        questionsSolved: 0,
        totalQuestions: 50,
        lod: 'Medium' as const,
      })),
    );
    await supabase.from('topics').upsert(rows, {
      onConflict: 'user_id,exam,section,topic',
    });
  } catch (error) {
    console.warn('Supabase sync failed (seed):', error);
  }
}


WebBrowser.maybeCompleteAuthSession();

/* ────────────────────────────────────────────────────
   Provider
   ──────────────────────────────────────────────────── */
export function TimerProvider({ children }: { children: React.ReactNode }) {
  /* ── auth ─────────────────────────── */
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [topics, setTopics] = useState<TopicRecord[]>([]); // Centralized study topics
  const topicsChannelRef = useRef<any>(null); // Track active topics channel
  const timerChannelRef = useRef<any>(null); // Track timer state channel
  const authLock = useRef(false);
  const handledUrlRef = useRef<string | null>(null); // Prevent double-handling results
  const { sync, rt } = useLocalSearchParams<{ sync?: string; rt?: string }>();
  const router = useRouter();

  /* ── timer state ──────────────────── */
  const defaultExam = EXAM_LIST[0];
  const defaultSection = Object.keys(SYLLABUS[defaultExam])[0];
  const defaultTopic = SYLLABUS[defaultExam][defaultSection].topics[0];

  const [exam, setExamRaw] = useState<ExamType>(defaultExam);
  const [section, setSectionRaw] = useState(defaultSection);
  const [topic, setTopicRaw] = useState(defaultTopic);
  const [ratio, setRatioRaw] = useState(25);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isFinished, setFinished] = useState(false);
  const [strictMode, setStrictRaw] = useState(false);
  const [recallText, setRecall] = useState('');
  const [attempted, setAttempted] = useState('0');
  const [correct, setCorrect] = useState('0');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncLock = useRef(false);
  const activeRef = useRef(isActive);
  activeRef.current = isActive;

  /* keep a mutable ref for latest values needed in sync */
  const stateRef = useRef({ ratio, exam, section, topic });
  useEffect(() => {
    stateRef.current = { ratio, exam, section, topic };
  }, [ratio, exam, section, topic]);

  // DEEP LINK HANDLER: Standardized Auth & Handshake parsing
  // v1.5.2 Correction: Handles cold launch and background events
  const handleUrl = async (url: string) => {
    if (!url) return;
    if (handledUrlRef.current === url) return;
    handledUrlRef.current = url; 

    try {
      console.log('[TimerContext] Handshaking URL:', url);
      
      // Normalize: Both Fragments (#) and Queries (?) must be parsed
      const normalizedUrl = url.replace('#', '?');
      const searchParams = new URLSearchParams(normalizedUrl.split('?')[1] || '');
      
      const code = searchParams.get('code');
      const access_token = searchParams.get('access_token');
      const refresh_token = searchParams.get('refresh_token') || searchParams.get('rt');
      const sync_id = searchParams.get('sync');

      let sessionRestored = false;

      // PRIORITY 1: Exchange Code for Session (PKCE)
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) sessionRestored = true;
      } 
      // PRIORITY 2: Full Token Pair restoration
      else if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (!error) sessionRestored = true;
      } 
      // PRIORITY 3: Single Token Refresh (Guarded Fallback)
      else if (refresh_token) {
        try {
          const { error } = await supabase.auth.refreshSession({ refresh_token });
          if (!error) sessionRestored = true;
        } catch (e) {
          console.warn('[TimerContext] Guarded refresh failed', e);
        }
      }

      // IDENTITY ADOPTION: Only proceed if session restoration was successful
      if (sessionRestored) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          if (sync_id && sync_id !== session.user.id) {
            await AsyncStorage.setItem('merge_from_id', sync_id);
          }
          // Immediate re-load to adoption state
          loadAll(true);
        }
      } else if (refresh_token || code) {
        console.warn('[TimerContext] Session restoration failed. Continuing as guest.');
      }
    } catch (e) {
      console.error("[TimerContext] Lifecycle auth error:", e);
    }
  };

  const loadAll = useCallback(async (mounted: boolean) => {
    if (authLock.current) return;
    authLock.current = true;
    try {
      const saved = await AsyncStorage.getItem('strictMode');
      if (saved !== null && mounted) setStrictRaw(JSON.parse(saved));
    } catch (e) { }

    try {
      // 1. Initial State Sync (Strict Correction Pass)
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl && mounted) {
        await handleUrl(initialUrl);
      }

      // 2. Verified Session Load
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user && mounted) {
        const newId = session.user.id;
        setUserEmail(session.user.email ?? 'Authenticated User');
        
        try {
          const oldId = await AsyncStorage.getItem('merge_from_id');
          if (oldId && oldId !== newId) {
            await mergeIdentity(oldId, newId);
            await AsyncStorage.removeItem('merge_from_id');
          }
        } catch (e) { }

        setUserId(newId);
        setAuthReady(true);
        return;
      }

      setUserEmail(null);

      // 3. Guaranteed Anonymous Bootstrap
      const uid = await ensureAuth();
      if (mounted) {
        setUserId(uid);
        setAuthReady(true);
      }
    } catch (err) {
      if (mounted) {
        setUserId(null);
        setAuthReady(true);
      }
    } finally {
      authLock.current = false;
    }
  }, [router]);

  useEffect(() => {
    let mounted = true;
    loadAll(mounted);

    // Runtime deep link listeners (v1.5.2)
    const linkSub = Linking.addEventListener('url', (event) => handleUrl(event.url));

    // GLOBAL AUTH HEARTBEAT: Reacts to logins/logouts in real-time
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      const currentUserId = session?.user?.id;
      if (
        (event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED' ||
          event === 'USER_UPDATED') &&
        currentUserId !== userId
      ) {
        loadAll(mounted);
      } else if (event === 'SIGNED_OUT') {
        setUserEmail(null);
        setUserId(null);
        loadAll(mounted);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      linkSub.remove();
    };
  }, [loadAll, userId]);


  // UPDATED: Centralized Topics Sync Effect with Auto-Seeding (v1.5.0)
  useEffect(() => {
    if (!userId || !authReady) return;
    let alive = true;

    const setupTopicsSync = async () => {
      try {
        // 1. Initial Fetch filtered by active exam
        let { data, error } = await supabase
          .from('topics')
          .select('*')
          .eq('user_id', userId)
          .eq('exam', exam)
          .order('section')
          .order('topic');

        if (error) {
          console.warn('Supabase sync failed (fetch):', error);
          return;
        }

        // 2. AUTO-SEED if this exam has no rows yet
        if (alive && data && data.length === 0) {
          await seedTopics(userId, exam);

          // Refetch immediately
          const { data: refetched, error: refetchErr } = await supabase
            .from('topics')
            .select('*')
            .eq('user_id', userId)
            .eq('exam', exam)
            .order('section')
            .order('topic');

          if (refetchErr) {
            console.warn('Supabase sync failed (refetch):', refetchErr);
            return;
          }
          data = refetched;
        }

        if (alive && data) setTopics(data);

        // 3. Establish Single Stable Realtime Listener
        const channel = supabase
          .channel(`topics-global-${exam}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'topics', filter: `user_id=eq.${userId}` },
            payload => {
              if (!alive) return;
              const n = payload.new as any;
              const o = payload.old as any;
              setTopics(prev => {
                if (payload.eventType === 'UPDATE' && n) {
                  return prev.map(t => (t.id === n.id ? { ...t, ...n } : t));
                } else if (payload.eventType === 'INSERT' && n) {
                  if (prev.find(t => t.id === n.id)) return prev;
                  return [...prev, n];
                } else if (payload.eventType === 'DELETE' && o) {
                  return prev.filter(t => t.id !== o.id);
                }
                return prev;
              });
            }
          )
          .subscribe();

        topicsChannelRef.current = channel;
      } catch (err) {
        console.warn('v1.5.0 Sync Error:', err);
      }
    };

    setupTopicsSync();

    return () => {
      alive = false;
      if (topicsChannelRef.current) {
        supabase.removeChannel(topicsChannelRef.current);
        topicsChannelRef.current = null;
      }
    };
  }, [userId, authReady, exam]);

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
            user_id: userId,
            is_active: active,
            remaining_seconds: remaining,
            end_time: endTime,
            duration_seconds: stateRef.current.ratio * 60,
            exam: stateRef.current.exam,
            section: stateRef.current.section,
            topic: stateRef.current.topic,
            updated_at: now.toISOString(),
          },
          { onConflict: 'user_id' },
        );
      } catch (err) {
        console.error('Timer sync error:', err);
      } finally {
        syncLock.current = false;
      }
    },
    [userId],
  );

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        // 1. Definitively clean up old subscriptions to prevent "postgres_changes" crashes
        if (timerChannelRef.current) {
          await supabase.removeChannel(timerChannelRef.current);
          timerChannelRef.current = null;
        }

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
          if (data.exam) setExamRaw(data.exam);
          if (data.section) setSectionRaw(data.section);
          if (data.topic) setTopicRaw(data.topic);
          setTimeout(() => { syncLock.current = false; }, 600);
        }
      } catch (error) {
        // Silent sync failure; retry on next heartbeat
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
          if (d.exam) setExamRaw(d.exam);
          if (d.section) setSectionRaw(d.section);
          if (d.topic) setTopicRaw(d.topic);
          setTimeout(() => { syncLock.current = false; }, 800);
        },
      ).subscribe();

    timerChannelRef.current = channel;

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
    const attCount = Math.max(0, parseInt(attempted, 10) || 0);
    const corCount = Math.min(attCount, Math.max(0, parseInt(correct, 10) || 0));
    const sessionSeconds = (stateRef.current.ratio * 60) - timeLeft;

    try {
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

      // 2. Log individual focus session
      await supabase.from('focus_sessions').insert({
        user_id: userId,
        exam: stateRef.current.exam,
        section: stateRef.current.section,
        topic: stateRef.current.topic,
        duration_seconds: sessionSeconds,
        questions_attempted: attCount,
        questions_correct: corCount,
        notes: recallText,
      });
    } catch (e) {
      console.error('Failed to log session:', e);
    }

    setFinished(false);
    setRecall('');
    setAttempted('0');
    setCorrect('0');
    const newTime = stateRef.current.ratio * 60;
    setTimeLeft(newTime);
    syncToSupabase(false, newTime);
  }, [userId, attempted, correct, syncToSupabase, timeLeft]);

  const mergeIdentity = async (oldId: string, newId: string) => {
    if (oldId === newId) return;

    let topicsMigrated = false;
    let timerMigrated = false;

    try {
      console.log(`[TimerContext] MERGING: ${oldId} -> ${newId}`);

      // STEP 1: Topics
      const { data: oldTopics, error: tFetchErr } = await supabase.from('topics').select('*').eq('user_id', oldId);
      if (tFetchErr) throw tFetchErr;

      if (oldTopics && oldTopics.length > 0) {
        for (const t of oldTopics) {
          const { id, created_at, updated_at, ...rest } = t;

          const { error: tErr } = await supabase
            .from('topics')
            .upsert(
              { ...rest, user_id: newId, updated_at: new Date().toISOString() },
              { onConflict: 'user_id,exam,section,topic' }
            );

          if (tErr) throw tErr;
        }
      }
      topicsMigrated = true;

      // STEP 2: Timer
      const { data: oldTimer, error: tmFetchErr } = await supabase.from('timer_state').select('*').eq('user_id', oldId).maybeSingle();
      if (tmFetchErr) throw tmFetchErr;

      if (oldTimer) {
        const { id, created_at, updated_at, ...rest } = oldTimer;

        const { error: tmErr } = await supabase
          .from('timer_state')
          .upsert(
            { ...rest, user_id: newId, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' }
          );

        if (tmErr) throw tmErr;
      }
      timerMigrated = true;

      // STEP 3: Focus Sessions
      const { data: oldSessions, error: fsFetchErr } = await supabase.from('focus_sessions').select('*').eq('user_id', oldId);
      if (fsFetchErr) throw fsFetchErr;

      if (oldSessions && oldSessions.length > 0) {
        // Migration of history doesn't need upsert conflict handling, just re-inserting under new ID
        const logs = oldSessions.map(({ id, created_at, ...rest }) => ({
          ...rest,
          user_id: newId
        }));
        const { error: fsErr } = await supabase.from('focus_sessions').insert(logs);
        if (fsErr) throw fsErr;
      }

      // STEP 4: CLEANUP ONLY IF ALL SUCCESS
      if (topicsMigrated && timerMigrated) {
        await supabase.from('topics').delete().eq('user_id', oldId);
        await supabase.from('timer_state').delete().eq('user_id', oldId);
        await supabase.from('focus_sessions').delete().eq('user_id', oldId);
        await AsyncStorage.removeItem('merge_from_id');
        console.log('[TimerContext] Atomic migration complete');
      }

    } catch (error) {
      console.error('Migration halted', { topicsMigrated, timerMigrated, error });
      Alert.alert(
        'Sync Postponed',
        'Connection lost. Your progress remains safe on this device.'
      );
    }
  };

  const signInWithGoogle = async () => {
    try {
      if (userId) await AsyncStorage.setItem('merge_from_id', userId);
      const redirectTo = Platform.OS === 'web'
        ? 'https://cfa-study-app-self.vercel.app/google-auth'
        : Linking.createURL('/google-auth');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) {
        Alert.alert('Login Error', error.message);
        return;
      }
      if (data?.url) {
        if (Platform.OS === 'web') {
          window.location.href = data.url;
          return;
        }
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (res.type !== 'success') console.log('Auth session was cancelled.');
      }
    } catch (e) {
      Alert.alert('Login Error', 'An unexpected error occurred during authentication.');
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    await AsyncStorage.removeItem('merge_from_id');
    handledUrlRef.current = null;
    setUserId(null);
    setUserEmail(null);
    setAuthReady(false);
    loadAll(true);
  };

  const forceMerge = async () => {
    try {
      const oldId = await AsyncStorage.getItem('merge_from_id');
      if (oldId && userId) {
        await mergeIdentity(oldId, userId);
        await AsyncStorage.removeItem('merge_from_id');
        loadAll(true);
        Alert.alert('Sync Successful', 'Your profile and progress have been synchronized.');
      }
    } catch (e) { }
  };

  const manualMerge = async (oldId: string) => {
    if (!userId || !oldId) return;
    try {
      await mergeIdentity(oldId, userId);
      loadAll(true);
      Alert.alert('Manual Sync Success', `Study history from device ${oldId.slice(0, 8)} has been merged.`);
    } catch (e) {
      Alert.alert('Sync Refused', 'Identity key invalid or connection timed out.');
    }
  };

  const resetSyllabus = async () => {

    if (!userId) return;
    try {
      console.log(`[TimerContext] RESETTING SYLLABUS: ${exam} for user ${userId}`);

      // 1. Wipe existing topics for this exam
      const { error: delErr } = await supabase
        .from('topics')
        .delete()
        .eq('user_id', userId)
        .eq('exam', exam);

      if (delErr) throw delErr;

      // 2. Re-seed correct topics
      await seedTopics(userId, exam);

      // 3. The existing setupTopicsSync effect will refetch automatically
      // since it's listening to the same 'exam' state.

      Alert.alert('Syllabus Repaired', `The ${exam} syllabus has been reset to its default state.`);
    } catch (err) {
      console.error('Reset failed', err);
      Alert.alert('Repair Failed', 'Could not reach server to reset syllabus.');
    }
  };

  return (
    <Ctx.Provider
      value={{
        userId, authReady, timeLeft, isActive, isFinished, ratio, exam, section, topic,
        strictMode, recallText, attemptedThisSession: attempted, correctThisSession: correct,
        setRatio, setExam, setSection, setTopic, setRecallText: setRecall, setAttempted, setCorrect,
        setStrictMode: async (v: boolean) => {
          setStrictRaw(v);
          try { await AsyncStorage.setItem('strictMode', JSON.stringify(v)); } catch (e) { }
        },
        startTimer, pauseTimer, resetTimer, submitRecall, refreshAuth: () => loadAll(true),
        signInWithGoogle, signOut, forceMerge, manualMerge, resetSyllabus, userEmail, topics,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

