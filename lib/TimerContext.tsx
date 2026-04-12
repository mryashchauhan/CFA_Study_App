import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus, Alert, Platform, Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
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
  setStrictMode: (v: boolean) => Promise<void>;
  setRecallText: (t: string)  => void;
  setAttempted:  (t: string)  => void;
  setCorrect:    (t: string)  => void;
  startTimer:    () => void;
  pauseTimer:    () => void;
  resetTimer:    () => void;
  submitRecall:  () => Promise<void>;
  refreshAuth:   () => void;
  signInWithGoogle: () => Promise<void>;
  signOut:       () => Promise<void>;
  forceMerge:    () => Promise<void>;
  manualMerge:   (oldId: string) => Promise<void>;
  handleSync:    () => Promise<void>;
  userEmail:     string | null;
  topics:        any[];
}

const Ctx = createContext<TimerCtx | null>(null);

export function useTimer(): TimerCtx {
  const c = useContext(Ctx);
  if (!c) {
    console.warn("TimerContext missing");
    return {} as TimerCtx;
  }
  return c;
}

WebBrowser.maybeCompleteAuthSession();

/* ────────────────────────────────────────────────────
   Provider
   ──────────────────────────────────────────────────── */
export function TimerProvider({ children }: { children: React.ReactNode }) {
  /* ── auth ─────────────────────────── */
  const [userId, setUserId]       = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [topics, setTopics]       = useState<any[]>([]); // Centralized study topics
  const topicsChannelRef = useRef<any>(null); // Track active topics channel
  const timerChannelRef = useRef<any>(null); // Track timer state channel
  const authLock = useRef(false);
  const { sync, rt } = useLocalSearchParams<{ sync?: string; rt?: string }>();
  const router = useRouter();

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
    if (authLock.current) return;
    authLock.current = true;
    try {
      const saved = await AsyncStorage.getItem('strictMode');
      if (saved !== null && mounted) setStrictRaw(JSON.parse(saved));
    } catch (e) {}

    try {
      setAuthReady(false);
      
      // 1. Sync Override (Zero-Input Cross-Device Handshake)
      let currentSync = sync;
      let currentRT = rt;
      if (Platform.OS === 'web' && (!currentSync || !currentRT)) {
        try {
          const params = new URLSearchParams(window.location.search);
          currentSync = params.get('sync') || undefined;
          currentRT = params.get('rt') || undefined;
        } catch (e) {}
      }

      if (currentSync && mounted) {
        if (currentRT) {
          try {
            const { data: { user } } = await supabase.auth.setSession({ 
              access_token: '', 
              refresh_token: currentRT 
            });
            if (user) {
              setUserId(user.id);
              setAuthReady(true);
              try { router.setParams({ sync: undefined, rt: undefined }); } catch (e) {}
              return;
            }
          } catch (e) {}
        }
        await AsyncStorage.setItem('supabase.auth.token', JSON.stringify({ user: { id: currentSync } })); 
        setUserId(currentSync);
        setAuthReady(true);
        try { router.setParams({ sync: undefined, rt: undefined }); } catch (e) {}
        return;
      }

      // 2. Standard Session Check
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && mounted) {
        const newId = session.user.id;
        setUserEmail(session.user.email ?? 'Google User');
        try {
          // CHECK FOR PENDING MERGE
          const oldId = await AsyncStorage.getItem('merge_from_id');
          if (oldId && oldId !== newId) {
            await mergeIdentity(oldId, newId);
            await AsyncStorage.removeItem('merge_from_id');
          }
        } catch (e) {}
        
        setUserId(newId);
        setAuthReady(true);
        return;
      }
      
      setUserEmail(null);

      // 3. Fallback to Anonymous
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
      setTimeout(() => { authLock.current = false; }, 500);
    }
  }, [sync, rt, router]);

  useEffect(() => {
    let mounted = true;
    loadAll(mounted);

    // DEEP LINK HANDLER (for Mobile Auth Redirects)
    const handleUrl = async (url: string) => {
      if (!url) return;
      const { queryParams } = Linking.parse(url);
      if (queryParams?.access_token || queryParams?.refresh_token) {
        // Force refresh session from deep link
        await supabase.auth.refreshSession();
        loadAll(mounted);
      }
    };

    Linking.getInitialURL().then(url => { if (url) handleUrl(url); });
    const linkSub = Linking.addEventListener('url', (event) => handleUrl(event.url));

    // GLOBAL AUTH HEARTBEAT: Reacts to logins/logouts in real-time
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
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
  }, [loadAll]);

  // NEW: Centralized Topics Sync Effect (Ironclad v1.4.0)
  useEffect(() => {
    if (!userId || !authReady) return;
    let alive = true;

    const setupTopicsSync = async () => {
      try {
        // 1. Definitively clean up old subscriptions
        if (topicsChannelRef.current) {
          await supabase.removeChannel(topicsChannelRef.current);
          topicsChannelRef.current = null;
        }

        // 2. Initial Fetch
        const { data } = await supabase
          .from('topics')
          .select('*')
          .eq('user_id', userId)
          .eq('exam', exam)
          .order('section')
          .order('topic');

        if (alive && data) setTopics(data);

        // 3. Establish Single Stable Realtime Listener
        const ch = supabase
          .channel(`topics-global-${exam}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'topics', filter: `user_id=eq.${userId}` },
            payload => {
              if (!alive) return;
              if (payload.eventType === 'UPDATE') {
                const u = payload.new as any;
                setTopics(prev => prev.map(t => (t.id === u.id ? { ...t, ...u } : t)));
              } else if (payload.eventType === 'INSERT') {
                setTopics(prev => {
                  if (prev.find(t => t.id === payload.new.id)) return prev;
                  return [...prev, payload.new];
                });
              } else if (payload.eventType === 'DELETE') {
                setTopics(prev => prev.filter(t => t.id !== payload.old.id));
              }
            }
          )
          .subscribe();

        topicsChannelRef.current = ch;
      } catch (err) {
        console.warn('v1.4.0 Sync Error:', err);
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
          if (data.exam)    setExamRaw(data.exam);
          if (data.section) setSectionRaw(data.section);
          if (data.topic)   setTopicRaw(data.topic);
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
          if (d.exam)    setExamRaw(d.exam);
          if (d.section) setSectionRaw(d.section);
          if (d.topic)   setTopicRaw(d.topic);
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
    } catch (e) {}

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
    try {
      // 1. Move topics progress
      const { data: oldTopics } = await supabase.from('topics').select('*').eq('user_id', oldId);
      if (oldTopics && oldTopics.length > 0) {
        for (const t of oldTopics) {
          const { id, created_at, updated_at, ...rest } = t;
          await supabase.from('topics').upsert({ 
            ...rest, 
            user_id: newId, 
            updated_at: new Date().toISOString() 
          }, { onConflict: 'user_id,exam,section,topic' });
        }
        // Cleanup old anonymous rows
        await supabase.from('topics').delete().eq('user_id', oldId);
      }
      
      // 2. Move timer state
      const { data: oldTimer } = await supabase.from('timer_state').select('*').eq('user_id', oldId).maybeSingle();
      if (oldTimer) {
        const { id, created_at, updated_at, ...rest } = oldTimer;
        await supabase.from('timer_state').upsert({
          ...rest,
          user_id: newId,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
        await supabase.from('timer_state').delete().eq('user_id', oldId);
      }
    } catch (e) {}
  };
  
  const handleSync = async () => {
    Alert.alert(
      'Sync Workspace',
      'This MAGIC LINK will instantly pair your other device to this study history without any login.\n\nInstructions:\n1. Share this link to your laptop/other device.\n2. Open it there to sync everything.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Generate Link', 
          onPress: async () => {
            try {
              const { data: { session } } = await supabase.auth.getSession();
              const rt = session?.refresh_token;              
              const syncURL = `https://cfa-study-app-self.vercel.app/?sync=${userId}${rt ? `&rt=${rt}` : ''}`;
              
              await Share.share({
                message: syncURL,
                url: syncURL,
              });
            } catch (error: any) {
              Alert.alert('Sharing Error', 'Unable to generate sync link at this time.');
            }
          } 
        }
      ]
    );
  };

  const signInWithGoogle = async () => {
    try {
      if (userId) {
        // Cache the current ID as a source for the upcoming identity merge
        await AsyncStorage.setItem('merge_from_id', userId);
      }
    } catch (e) {}

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: Platform.OS === 'web' 
          ? window.location.origin 
          : 'cfastudyapp://google-auth', // Points to our new dedicated landing pad
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      Alert.alert('Login Error', error.message);
      return;
    }

    if (data?.url) {
      // Launch native auth session
      const res = await WebBrowser.openAuthSessionAsync(data.url, 'cfastudyapp://google-auth');
      if (res.type === 'success' && res.url) {
        // Capture hash and session
        const { queryParams } = Linking.parse(res.url);
        if (queryParams?.access_token) {
          await supabase.auth.setSession({
            access_token: queryParams.access_token as string,
            refresh_token: queryParams.refresh_token as string,
          });
        }
      }
    }
    // Note: We no longer call loadAll(true) here because the onAuthStateChange listener
    // in this same context will trigger the reload as soon as the session is captured.
  };

  const signOut = async () => {
    await supabase.auth.signOut();
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
        Alert.alert('Sync Successful', `History from ${oldId.slice(0, 6)}... merged into your Google account.`);
      } else {
        Alert.alert('Sync Check', 'Your study data is already up to date.');
      }
    } catch (e) {}
  };

  const manualMerge = async (oldId: string) => {
    if (!userId || !oldId) return;
    try {
      await mergeIdentity(oldId, userId);
      loadAll(true);
      Alert.alert('Manual Sync Success', `Study history from device ${oldId.slice(0, 8)} has been merged.`);
    } catch (e) {
      Alert.alert('Manual Sync Error', 'Could not find data for that ID.');
    }
  };

  /* Identity Merge Effect */
  useEffect(() => {
    const autoMerge = async () => {
      if (!userId) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id === userId && session.user.app_metadata?.provider === 'google') {
        // We are logged in with google. Check if there is an old anonymous session we can merge from.
        // For this to work perfectly, we need to have cached the old ID before redirect.
        // Simplified: Merge is usually done server-side or via a specific 'Link Account' flow.
        // For now, we will assume standard auth is sufficient.
      }
    };
    autoMerge();
  }, [userId]);

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
        signInWithGoogle, signOut, forceMerge, manualMerge, handleSync, userEmail, userId, topics,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
