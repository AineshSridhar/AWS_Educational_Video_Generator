import { useState } from 'react'
import { motion } from 'framer-motion'
import { InputForm } from './input-form'
import { StatusPolling } from './status-polling'
import { SuccessScreen } from './success-screen'
import { Card } from '@/components/ui/card'

type GeneratorState = 'idle' | 'polling' | 'success' | 'error'

export function VideoGenerator() {
    const [state, setState] = useState<GeneratorState>('idle')
    const [jobId, setJobId] = useState<string | null>(null)
    const [videoUrl, setVideoUrl] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const handleJobCreated = (newJobId: string) => {
        setJobId(newJobId)
        setState('polling')
        setError(null)
    }

    const handleSuccess = (url: string) => {
        setVideoUrl(url)
        setState('success')
    }

    const handleError = (message: string) => {
        setError(message)
        setState('error')
    }

    const handleReset = () => {
        setState('idle')
        setJobId(null)
        setVideoUrl(null)
        setError(null)
    }

    return (
        <div className="flex flex-col min-h-screen px-4 py-12">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="mb-12 text-center"
            >
                <h1 className="text-4xl md:text-5xl font-bold mb-3 gradient-text">
                    AI Video Generator
                </h1>
                <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
                    Transform your educational scripts into stunning videos.
                </p>
            </motion.div>

            {/* Main Content */}
            <div className="flex-1 flex items-center justify-center max-w-4xl mx-auto w-full">
                {state === 'idle' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="w-full"
                    >
                        <InputForm onJobCreated={handleJobCreated} />
                    </motion.div>
                )}

                {state === 'polling' && jobId && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="w-full"
                    >
                        <StatusPolling
                            jobId={jobId}
                            onSuccess={handleSuccess}
                            onError={handleError}
                        />
                    </motion.div>
                )}

                {state === 'success' && videoUrl && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="w-full"
                    >
                        <SuccessScreen videoUrl={videoUrl} onReset={handleReset} />
                    </motion.div>
                )}

                {state === 'error' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="w-full"
                    >
                        <Card className="glass-card p-8">
                            <div className="text-center">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-4">
                                    <svg
                                        className="w-8 h-8 text-destructive"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold mb-2">Generation Failed</h3>
                                <p className="text-muted-foreground mb-6">{error}</p>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleReset}
                                    className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                                >
                                    Try Again
                                </motion.button>
                            </div>
                        </Card>
                    </motion.div>
                )}
            </div>
        </div>
    )
}
