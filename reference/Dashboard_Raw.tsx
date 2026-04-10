import { Google as GoogleIcon } from '@mui/icons-material';
import { Box, Button, CircularProgress, Container, CssBaseline, FormControl, InputLabel, MenuItem, Paper, Select, ThemeProvider, Typography } from '@mui/material';
import React, { useEffect } from 'react';
import Analytics from './components/Analytics';
import Dashboard from './components/Dashboard';
import Layout from './components/Layout';
import Revision from './components/Revision';
import Syllabus from './components/Syllabus';
import { EXAMS } from './constants';
import { initializeStore, useStore } from './store';
import { theme } from './theme';

export default function App() {
    const { user, isLoading, error, selectedExamId, setSelectedExamId, login, activeTab, setActiveTab } = useStore();

    useEffect(() => {
        const unsubscribe = initializeStore();
        return () => unsubscribe();
    }, []);

    if (isLoading) {
        return (
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', bgcolor: 'background.default' }}>
                    <CircularProgress size={60} thickness={4} />
                    <Typography variant="h6" sx={{ mt: 3, color: 'text.secondary' }}>
                        Syncing with Firebase...
                    </Typography>
                </Box>
            </ThemeProvider>
        );
    }

    if (!user) {
        return (
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <Box sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'background.default',
                    p: 3
                }}>
                    <Container maxWidth="sm">
                        <Paper elevation={0} sx={{
                            p: 5,
                            textAlign: 'center',
                            borderRadius: '24px',
                            border: '1px solid',
                            borderColor: 'divider'
                        }}>
                            <Typography variant="h3" gutterBottom sx={{ fontWeight: 800, color: 'primary.main' }}>
                                ExamPrep AI
                            </Typography>
                            <Typography variant="h6" color="text.secondary" sx={{ mb: 4 }}>
                                Your intelligent companion for competitive exam preparation.
                            </Typography>
                            <Button
                                variant="contained"
                                size="large"
                                startIcon={<GoogleIcon />}
                                onClick={login}
                                sx={{
                                    py: 1.5,
                                    px: 4,
                                    borderRadius: '12px',
                                    textTransform: 'none',
                                    fontSize: '1.1rem',
                                    fontWeight: 600
                                }}
                            >
                                Sign in with Google
                            </Button>
                            {error && (
                                <Typography color="error" sx={{ mt: 2 }}>
                                    {error}
                                </Typography>
                            )}
                        </Paper>
                    </Container>
                </Box>
            </ThemeProvider>
        );
    }

    if (error) {
        return (
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', bgcolor: 'background.default', p: 3, textAlign: 'center' }}>
                    <Typography variant="h4" color="error" gutterBottom>
                        Connection Error
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        {error}
                    </Typography>
                </Box>
            </ThemeProvider>
        );
    }

    const renderContent = () => {
        switch (activeTab) {
            case 0: return <Dashboard />;
            case 1: return <Syllabus />;
            case 2: return <Analytics />;
            case 3: return <Revision />;
            default: return <Dashboard />;
        }
    };

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel id="exam-select-label">Target Exam</InputLabel>
                        <Select
                            labelId="exam-select-label"
                            value={selectedExamId}
                            label="Target Exam"
                            onChange={(e) => setSelectedExamId(e.target.value)}
                            sx={{ bgcolor: 'background.paper', borderRadius: '8px' }}
                        >
                            {EXAMS.map((exam) => (
                                <MenuItem key={exam.id} value={exam.id}>
                                    {exam.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>
                {renderContent()}
            </Layout>
        </ThemeProvider>
    );
}

