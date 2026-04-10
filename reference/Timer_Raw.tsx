import React, { useCallback, useEffect, useRef, useState } from 'react';

const SYLLABUS_DATA = {
    CFA: {
        Ethics: ['Standards of Practice', 'Code of Ethics', 'GIPS'],
        Quantitative_Methods: ['Time Value of Money', 'Probability', 'Regression'],
        Economics: ['Microeconomics', 'Macroeconomics', 'Geopolitics'],
        Corporate_Issuers: ['Corporate Governance', 'Capital Structure', 'Business Models'],
        FSA: ['Income Statements', 'Balance Sheets', 'Cash Flow Analysis'],
        Equity: ['Market Structure', 'Valuation Concepts', 'Industry Analysis'],
        Fixed_Income: ['Bond Valuation', 'Yield Measures', 'Credit Analysis'],
        Derivatives: ['Options', 'Forwards and Futures', 'Swaps'],
        Alternatives: ['Real Estate', 'Private Equity', 'Hedge Funds'],
        Portfolio_Management: ['Risk and Return', 'Behavioral Finance', 'Technical Analysis']
    },
    ATMA: {
        Analytical_Reasoning: ['Coding Decoding', 'Syllogism', 'Blood Relations', 'Arrangements', 'Data Sufficiency'],
        Verbal_Skills: ['Reading Comprehension', 'Grammar', 'Vocabulary', 'Para Jumbles'],
        Quantitative_Skills: ['Data Interpretation', 'Arithmetic', 'Algebra', 'Geometry', 'Modern Math']
    },
    MAT: {
        Language_Comprehension: ['Reading Comprehension', 'Sentence Correction', 'Idioms'],
        Intelligence_Reasoning: ['Puzzles', 'Direction Sense', 'Critical Reasoning', 'Input Output'],
        Mathematical_Skills: ['Arithmetic', 'Number System', 'Mensuration', 'Probability'],
        Data_Analysis: ['Pie Charts', 'Bar Graphs', 'Data Sufficiency', 'Venn Diagrams'],
        Global_Environment: ['Current Affairs', 'Indian Economy', 'Corporate News']
    }
} as const;

const RATIOS = [1, 15, 25, 52, 90];

const EXAM_DATES = {
    CFA: '2026-05-17',
    ATMA: '2026-05-03',
    MAT: '2026-05-25'
} as const;

type ExamType = keyof typeof SYLLABUS_DATA;

interface SessionLog {
    id: string;
    timestamp: string;
    path: string;
    literalMinutes: number;
    intensityScore: number;
    userNote: string;
    status: 'Completed' | 'Failed';
    type: 'Work' | 'Break';
    exam: string;
}

const PredictivePlanner = ({ totalLoggedHours = 0, exam }: { totalLoggedHours: number, exam: ExamType }) => {
    const [targetHoursMap, setTargetHoursMap] = useState<Record<string, string>>({
        CFA: '300',
        ATMA: '150',
        MAT: '100'
    });

    const targetHours = targetHoursMap[exam] || '100';
    const examDate = new Array(EXAM_DATES[exam])[0] ? new Date(EXAM_DATES[exam]) : new Date();
    const today = new Date();
    const diffTime = examDate.getTime() - today.getTime();
    const daysRemaining = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    const remainingHours = Math.max(0, parseInt(targetHours || '0') - totalLoggedHours);
    const dailyTarget = (remainingHours / daysRemaining).toFixed(1);
    const progress = Math.min((totalLoggedHours / Math.max(parseInt(targetHours || '1'), 1)) * 100, 100);

    return (
        <div className="bg-[#121212] border border-[#1F1F1F] rounded-[32px] p-6 shadow-lg space-y-4 my-3">
            <div className="flex justify-between items-center">
                <h3 className="text-white font-bold flex items-center gap-2">
                    🎯 {exam} Planner
                </h3>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest bg-black px-2 py-1 rounded">
                    {new Date(EXAM_DATES[exam]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Goal (Hrs)</label>
                    <input
                        type="number"
                        value={targetHours}
                        onChange={(e) => setTargetHoursMap(prev => ({ ...prev, [exam]: e.target.value }))}
                        className="w-full bg-black border border-[#1F1F1F] rounded-xl p-3 text-center text-white focus:outline-none focus:ring-1 focus:ring-[#FF3B30] text-base"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Days Left</label>
                    <div className="w-full bg-black border border-[#1F1F1F] rounded-xl p-3 text-center text-slate-400 text-base font-bold">
                        {daysRemaining}
                    </div>
                </div>
            </div>

            <div className="text-center space-y-2">
                <div className="text-sm text-slate-300">
                    Required Pacing: <span className="text-[#FF3B30] font-bold">{dailyTarget} hrs/day</span>
                </div>
                <div className="w-full h-1.5 bg-black rounded-full overflow-hidden">
                    <div
                        className="h-full bg-[#FF3B30] transition-all duration-500 shadow-[0_0_10px_rgba(255,59,48,0.5)]"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

export default function App() {
    const [activeTab, setActiveTab] = useState<'timer' | 'planner'>('timer');
    const [ratio, setRatio] = useState<number>(25);
    const [difficulty, setDifficulty] = useState(1);
    const [timeLeft, setTimeLeft] = useState(25 * 60);
    const [isActive, setIsActive] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [strictMode, setStrictMode] = useState(false);

    const [exam, setExam] = useState<ExamType>('CFA');
    const [subject, setSubject] = useState<string>('Ethics');
    const [topic, setTopic] = useState<string>(SYLLABUS_DATA['CFA']['Ethics'][0]);
    const [recallText, setRecallText] = useState('');

    const [sessions, setSessions] = useState<SessionLog[]>([]);
    const [streak, setStreak] = useState(0);
    const wakeLockRef = useRef<any>(null);

    useEffect(() => {
        const stored = localStorage.getItem('study_logs');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setSessions(parsed);
                calculateStreak(parsed);
            } catch (e) {
                console.error('Failed to parse sessions');
            }
        }
    }, []);

    const calculateStreak = (logs: SessionLog[]) => {
        if (!logs || logs.length === 0) return;
        const completedDates = new Set(
            logs
                .filter(s => s.status === 'Completed')
                .map(s => new Date(s.timestamp).toLocaleDateString())
        );

        let currentStreak = 0;
        let checkDate = new Date();

        while (completedDates.has(checkDate.toLocaleDateString())) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
        }
        setStreak(currentStreak);
    };

    const saveSession = useCallback((status: 'Completed' | 'Failed', note: string = 'No notes') => {
        const baseMinutes = ratio;
        const intensity = baseMinutes * difficulty;

        const newSession: SessionLog = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            path: `${exam} > ${subject} > ${topic}`,
            literalMinutes: baseMinutes,
            intensityScore: intensity,
            userNote: note,
            status,
            type: 'Work',
            exam
        };

        setSessions(prev => {
            const updated = [newSession, ...prev];
            localStorage.setItem('study_logs', JSON.stringify(updated));
            calculateStreak(updated);
            return updated;
        });
    }, [ratio, difficulty, exam, subject, topic]);

    useEffect(() => {
        let interval: number | undefined;

        if (isActive && timeLeft > 0) {
            interval = window.setInterval(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
        } else if (isActive && timeLeft === 0) {
            setIsActive(false);
            setIsFinished(true); // Trigger Active Recall Gate
        }

        return () => clearInterval(interval);
    }, [isActive, timeLeft]);

    useEffect(() => {
        const requestWakeLock = async () => {
            if (isActive && 'wakeLock' in navigator) {
                try {
                    if ((navigator as any).permissions) {
                        const status = await (navigator as any).permissions.query({ name: 'screen-wake-lock' });
                        if (status.state === 'denied') return;
                    }
                    wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
                } catch (err: any) {
                    console.warn('Wake Lock error:', err);
                }
            }
        };

        const releaseWakeLock = async () => {
            if (!isActive && wakeLockRef.current) {
                try {
                    await wakeLockRef.current.release();
                    wakeLockRef.current = null;
                } catch (err) {
                    console.error('Wake Lock release error:', err);
                }
            }
        };

        if (isActive) requestWakeLock();
        else releaseWakeLock();

        return () => { releaseWakeLock(); };
    }, [isActive]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden && isActive && strictMode) {
                setIsActive(false);
                saveSession('Failed', 'Strict Mode Violation');
                setTimeLeft(ratio * 60);
                alert("Strict Mode Violation! You left the app. Session failed.");
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [isActive, strictMode, ratio, saveSession]);

    const toggleTimer = () => setIsActive(!isActive);

    const resetTimer = () => {
        setIsActive(false);
        setTimeLeft(ratio * 60);
    };

    const handleLogSession = () => {
        if (recallText.length < 10) return;
        saveSession('Completed', recallText);
        setIsFinished(false);
        setRecallText('');
        setTimeLeft(ratio * 60);
        setActiveTab('planner');
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const totalLoggedHours = sessions
        .filter(s => s.status === 'Completed' && s.type === 'Work' && s.exam === exam)
        .reduce((acc, s) => acc + (s.literalMinutes / 60), 0);

    return (
        <div className="h-screen bg-black text-slate-50 font-sans flex flex-col overflow-hidden">
            <div className="flex-1 max-w-md w-full mx-auto p-4 flex flex-col overflow-y-auto">

                {activeTab === 'planner' ? (
                    <div className="space-y-4 pb-4">
                        <PredictivePlanner totalLoggedHours={totalLoggedHours} exam={exam} />

                        <div className="bg-[#121212] rounded-[32px] p-6 border border-[#1F1F1F] shadow-lg space-y-4 my-3">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-white">Syllabus Configuration</h2>

                            <div className="space-y-2">
                                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Select Exam</label>
                                <div className="flex flex-wrap gap-2">
                                    {Object.keys(SYLLABUS_DATA).map(ex => (
                                        <button
                                            key={ex}
                                            onClick={() => {
                                                const newExam = ex as ExamType;
                                                setExam(newExam);
                                                const firstSub = Object.keys(SYLLABUS_DATA[newExam])[0];
                                                setSubject(firstSub);
                                                setTopic((SYLLABUS_DATA[newExam] as any)[firstSub][0]);
                                            }}
                                            className={`px-4 py-2 rounded-[20px] text-sm font-semibold border transition-all ${exam === ex ? 'border-[#FF3B30] bg-[#FF3B30]/10 text-[#FF3B30] shadow-[0_0_8px_rgba(255,59,48,0.5)]' : 'bg-black border-[#1F1F1F] text-slate-400'}`}
                                        >
                                            {ex}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Select Subject</label>
                                <div className="flex flex-wrap gap-2">
                                    {Object.keys(SYLLABUS_DATA[exam]).map(sub => (
                                        <button
                                            key={sub}
                                            onClick={() => {
                                                setSubject(sub);
                                                setTopic((SYLLABUS_DATA[exam] as any)[sub][0]);
                                            }}
                                            className={`px-4 py-2 rounded-[20px] text-sm font-semibold border transition-all ${subject === sub ? 'border-[#FF3B30] bg-[#FF3B30]/10 text-[#FF3B30] shadow-[0_0_8px_rgba(255,59,48,0.5)]' : 'bg-black border-[#1F1F1F] text-slate-400'}`}
                                        >
                                            {sub.replace('_', ' ')}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Select Topic</label>
                                <div className="flex flex-wrap gap-2">
                                    {(SYLLABUS_DATA[exam] as any)[subject].map((t: string) => (
                                        <button
                                            key={t}
                                            onClick={() => setTopic(t)}
                                            className={`px-4 py-2 rounded-[20px] text-sm font-semibold border transition-all ${topic === t ? 'border-[#FF3B30] bg-[#FF3B30]/10 text-[#FF3B30] shadow-[0_0_8px_rgba(255,59,48,0.5)]' : 'bg-black border-[#1F1F1F] text-slate-400'}`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="bg-[#121212] rounded-[32px] p-6 border border-[#1F1F1F] shadow-lg space-y-4 my-3">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-white">Timer Config</h2>

                            <div className="space-y-2">
                                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Timer Duration</label>
                                <div className="flex flex-wrap gap-2">
                                    {RATIOS.map(r => (
                                        <button
                                            key={r}
                                            onClick={() => {
                                                setRatio(r);
                                                if (!isActive) setTimeLeft(r * 60);
                                            }}
                                            className={`px-4 py-2 rounded-[20px] text-sm font-semibold border transition-all ${ratio === r ? 'border-[#FF3B30] bg-[#FF3B30]/10 text-[#FF3B30] shadow-[0_0_8px_rgba(255,59,48,0.5)]' : 'bg-black border-[#1F1F1F] text-slate-400'}`}
                                        >
                                            {r} min
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="bg-[#121212] rounded-[32px] p-6 border border-[#1F1F1F] shadow-lg my-3">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">Recent Sessions</h2>
                            <div className="space-y-3">
                                {sessions.slice(0, 5).map(s => (
                                    <div key={s.id} className="flex items-center justify-between p-4 rounded-[20px] bg-black border border-[#1F1F1F]">
                                        <div className="flex-1 min-w-0 pr-4">
                                            <div className="text-sm font-medium text-slate-200 truncate">{s.path}</div>
                                            <div className="text-xs text-slate-500 mt-0.5">
                                                {new Date(s.timestamp).toLocaleDateString()} • {s.literalMinutes}m
                                            </div>
                                        </div>
                                        <div className={`text-[10px] font-bold px-2 py-1 rounded-md shrink-0 uppercase tracking-wider ${s.status === 'Failed' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                            {s.status}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col justify-between pb-4">
                        {isFinished ? (
                            <div className="flex-1 flex flex-col justify-center">
                                <div className="bg-[#121212] border border-[#1F1F1F] rounded-[32px] p-6 shadow-lg space-y-4 my-3">
                                    <h2 className="text-lg font-bold text-[#FF3B30]">Active Recall Gate</h2>
                                    <p className="text-sm text-slate-400">Summarize your session ({recallText.length}/10 chars min)</p>
                                    <textarea
                                        value={recallText}
                                        onChange={e => setRecallText(e.target.value)}
                                        className="w-full bg-black border border-[#1F1F1F] rounded-[20px] p-4 text-white min-h-[120px] focus:outline-none focus:border-[#FF3B30]"
                                        placeholder="I learned that..."
                                        autoFocus
                                    />
                                    {recallText.length >= 10 && (
                                        <button onClick={handleLogSession} className="w-full py-4 rounded-[20px] bg-[#FF3B30] text-white font-bold shadow-[0_4px_10px_rgba(255,59,48,0.4)]">
                                            Log Session
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex-1 flex flex-col items-center justify-center">
                                    <div className="bg-[#121212] border border-[#1F1F1F] rounded-[20px] px-6 py-3 mb-10">
                                        <div className="text-xs font-bold text-white uppercase tracking-widest text-center truncate">
                                            {exam} &gt; {subject} &gt; {topic}
                                        </div>
                                    </div>
                                    <div className="w-[280px] h-[280px] rounded-full border-4 border-[#FF3B30] bg-black flex items-center justify-center shadow-[0_0_20px_rgba(255,59,48,0.6)]">
                                        <div className="text-7xl font-mono font-bold text-white drop-shadow-[0_0_15px_rgba(255,59,48,0.8)]" style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '2px', paddingLeft: '2px' }}>
                                            {formatTime(timeLeft)}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col items-center justify-end w-full pb-4">
                                    <div className="flex items-center justify-center w-full gap-4">
                                        <button onClick={toggleTimer} className={`px-8 py-4 rounded-full font-bold tracking-wider min-w-[140px] shadow-lg transition-all ${isActive ? 'bg-[#121212] border border-[#1F1F1F] text-white' : 'bg-[#FF3B30] text-white shadow-[0_4px_10px_rgba(255,59,48,0.4)]'}`}>
                                            {isActive ? 'PAUSE' : 'START'}
                                        </button>
                                        <button onClick={resetTimer} className="px-8 py-4 rounded-full font-bold tracking-wider bg-[#121212] border border-[#1F1F1F] text-slate-400 min-w-[120px]">
                                            RESET
                                        </button>
                                    </div>

                                    <div className="w-full flex items-center justify-between px-4 mt-8">
                                        <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Strict Mode</span>
                                        <button onClick={() => setStrictMode(!strictMode)} className={`w-12 h-6 rounded-full p-1 transition-colors ${strictMode ? 'bg-[#FF3B30]' : 'bg-[#1F1F1F]'}`}>
                                            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${strictMode ? 'translate-x-6' : 'translate-x-0'}`} />
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Tab Bar */}
            <div className="w-full max-w-md mx-auto bg-black border-t border-[#1F1F1F] flex justify-around items-center pb-safe shrink-0">
                <button onClick={() => setActiveTab('timer')} className="flex-1 py-4 flex flex-col items-center relative">
                    <span className={`text-lg font-bold tracking-[1px] uppercase ${activeTab === 'timer' ? 'text-[#FF3B30]' : 'text-slate-500'}`}>Timer</span>
                    {activeTab === 'timer' && <div className="absolute bottom-0 w-10 h-1 bg-[#FF3B30] rounded-t-full shadow-[0_-2px_4px_rgba(255,59,48,0.8)]" />}
                </button>
                <button onClick={() => setActiveTab('planner')} className="flex-1 py-4 flex flex-col items-center relative">
                    <span className={`text-lg font-bold tracking-[1px] uppercase ${activeTab === 'planner' ? 'text-[#FF3B30]' : 'text-slate-500'}`}>Planner</span>
                    {activeTab === 'planner' && <div className="absolute bottom-0 w-10 h-1 bg-[#FF3B30] rounded-t-full shadow-[0_-2px_4px_rgba(255,59,48,0.8)]" />}
                </button>
            </div>
        </div>
    );
}
