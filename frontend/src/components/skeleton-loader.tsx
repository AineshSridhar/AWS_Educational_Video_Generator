'use client'

import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'

export function SkeletonLoader() {
    return (
        <Card className="glass-card p-8 space-y-6">
            {/* Header Skeleton */}
            <div className="space-y-2">
                <motion.div
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="h-8 bg-muted rounded-lg w-40"
                />
                <motion.div
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, delay: 0.2 }}
                    className="h-4 bg-muted rounded-lg w-60"
                />
            </div>

            {/* Timeline Skeleton */}
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <motion.div
                        key={i}
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity, delay: i * 0.1 }}
                        className="flex items-center gap-4"
                    >
                        <div className="w-10 h-10 rounded-full bg-muted" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-muted rounded-lg w-32" />
                            <div className="h-3 bg-muted rounded-lg w-40 opacity-50" />
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Progress Bar Skeleton */}
            <div className="space-y-2">
                <motion.div
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="h-2 bg-muted rounded-full"
                />
            </div>
        </Card>
    )
}
