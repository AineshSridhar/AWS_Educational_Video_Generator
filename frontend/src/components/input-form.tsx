import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'


const API_BASE_URL = "http://localhost:8000/"


interface InputFormProps {
    onJobCreated: (jobId: string) => void
}

const STYLE_OPTIONS = [
    { value: 'documentary', label: 'Documentary', icon: '🎬' },
    { value: 'cinematic', label: 'Cinematic', icon: '🎥' },
    { value: 'animated', label: 'Animated', icon: '✨' },
    { value: 'tutorial', label: 'Tutorial', icon: '📚' },
    { value: '3d-diagram', label: '3D Diagram', icon: '📐' },
    { value: '2d-cartoon', label: '2D Cartoon', icon: '🎨' },

]

export function InputForm({ onJobCreated }: InputFormProps) {
    const [script, setScript] = useState('')
    const [selectedStyle, setSelectedStyle] = useState('documentary')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!script.trim()) {
            setError('Please enter a script')
            return
        }

        setLoading(true)
        setError(null)

        try {
            console.log({script,style:selectedStyle})
            const response = await fetch(`${API_BASE_URL}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ script, style: selectedStyle }),
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.detail || 'Failed to generate video')
            }

            const data = await response.json()
            onJobCreated(data.job_id)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card className="glass-card p-8 space-y-8">
            <div>
                <h2 className="text-2xl font-semibold mb-2">Create Your Video</h2>
                <p className="text-muted-foreground">
                    Write your educational script and select a visual style
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Script Input */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium">
                        Educational Script
                    </label>
                    <motion.textarea
                        whileFocus={{ scale: 1.01 }}
                        value={script}
                        onChange={(e) => setScript(e.target.value)}
                        placeholder="Enter your educational script (e.g. The Krebs Cycle is a series of chemical reactions...)"
                        className="w-full h-48 p-4 rounded-lg border border-border bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                    />
                </div>

                {/* Style Selection */}
                <div className="space-y-3">
                    <label className="block text-sm font-medium">Visual Style</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {STYLE_OPTIONS.map((option) => (
                            <motion.button
                                key={option.value}
                                type="button"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setSelectedStyle(option.value)}
                                className={`p-3 rounded-lg border-2 transition-all ${
                                    selectedStyle === option.value
                                        ? 'border-primary bg-primary/10'
                                        : 'border-border bg-transparent hover:border-primary/50'
                                }`}
                            >
                                <div className="text-2xl mb-1">{option.icon}</div>
                                <div className="text-xs font-medium">{option.label}</div>
                            </motion.button>
                        ))}
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm"
                    >
                        {error}
                    </motion.div>
                )}

                {/* Submit Button */}
                <motion.div
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                >
                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 hover:from-primary/90 hover:to-accent/90 text-primary-foreground font-semibold rounded-lg transition-all disabled:opacity-50"
                    >
                        {loading ? (
                            <span className="flex items-center gap-2">
                <span className="animate-spin">⚙️</span>
                Generating...
              </span>
                        ) : (
                            'Generate Video'
                        )}
                    </Button>
                </motion.div>
            </form>
        </Card>
    )
}
