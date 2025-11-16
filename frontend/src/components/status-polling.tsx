import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card.tsx'
import { StatusTimeline } from './status-timeline'
import { SkeletonLoader } from './skeleton-loader'

interface StatusPollingProps {
    jobId: string
    onSuccess: (videoUrl: string) => void
    onError: (error: string) => void
}

interface JobStatus {
    status: string
    progress: string
    video_url: string | null
}

const STATUS_PHASES = [
    { id: 'QUEUED', label: 'Queued', icon: '📋' },
    { id: 'ANALYZING_SCRIPT', label: 'Analyzing Script', icon: '📝' },
    { id: 'GENERATING_PROMPTS', label: 'Generating Prompts', icon: '✨' },
    { id: 'INVOKING_BEDROCK', label: 'Invoking Bedrock', icon: '🚀' },
    { id: 'POLLING_CLIPS', label: 'Processing Clips', icon: '🎬' },
    { id: 'COMPLETED', label: 'Complete', icon: '✅' },
]

export function StatusPolling({ jobId, onSuccess, onError }: StatusPollingProps) {
    const [status, setStatus] = useState<JobStatus | null>(null)
    const [isPolling, setIsPolling] = useState(true)
    const [failureCount, setFailureCount] = useState(0)

    useEffect(() => {
        if (!isPolling || !jobId) return

        const pollStatus = async () => {
            try {
                const response = await fetch(`/api/status/${jobId}`)
                if (!response.ok) throw new Error('Failed to fetch status')

                const data: JobStatus = await response.json()
                setStatus(data)
                setFailureCount(0)

                if (data.status === 'COMPLETED') {
                    if (data.video_url) {
                        setIsPolling(false)
                        onSuccess(data.video_url)
                    } else {
                        onError('Video generation completed but no URL provided')
                        setIsPolling(false)
                    }
                } else if (data.status === 'FAILED') {
                    onError(data.progress || 'Video generation failed')
                    setIsPolling(false)
                }
            } catch (err) {
                setFailureCount((prev) => prev + 1)
                if (failureCount > 10) {
                    onError('Connection lost. Please try again.')
                    setIsPolling(false)
                }
            }
        }

        const interval = setInterval(pollStatus, 3000)
        pollStatus()

        return () => clearInterval(interval)
    }, [jobId, isPolling, failureCount, onSuccess, onError])

    if (!status) {
        return <SkeletonLoader />
    }

    const currentPhaseIndex = STATUS_PHASES.findIndex(
        (p) => p.id === status.status
    )

    return (
        <div className="space-y-6">
            {/* Main Status Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <Card className="glass-card p-8">
                    <div className="space-y-6">
                        {/* Header */}
                        <div>
                            <h2 className="text-2xl font-semibold mb-2">Video Generation</h2>
                            <p className="text-muted-foreground">{status.progress}</p>
                        </div>

                        {/* Timeline */}
                        <StatusTimeline
                            phases={STATUS_PHASES}
                            currentPhaseIndex={currentPhaseIndex}
                        />

                        {/* Progress Bar */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Progress</span>
                                <span className="font-medium">
                  {Math.round(((currentPhaseIndex + 1) / STATUS_PHASES.length) * 100)}%
                </span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{
                                        width: `${((currentPhaseIndex + 1) / STATUS_PHASES.length) * 100}%`,
                                    }}
                                    transition={{ duration: 0.8, ease: 'easeInOut' }}
                                    className="h-full bg-gradient-to-r from-primary via-accent to-secondary"
                                />
                            </div>
                        </div>
                    </div>
                </Card>
            </motion.div>

            {/* Details */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
            >
                <Card className="glass-card p-6">
                    <div className="text-sm space-y-3">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Job ID</span>
                            <span className="font-mono text-xs">{jobId}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Status</span>
                            <span className="font-medium capitalize">{status.status}</span>
                        </div>
                    </div>
                </Card>
            </motion.div>
        </div>
    )
}
