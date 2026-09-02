import { Component, ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme/useTheme'

function ErrorFallback({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const c = useTheme()
  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Text style={[styles.title, { color: c.onSurface }]}>Something went wrong</Text>
      <Text style={[styles.message, { color: c.onSurfaceVariant }]}>{error.message}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Try again"
        onPress={onRetry}
        style={[styles.button, { backgroundColor: c.controlAccent }]}
      >
        <Text style={[styles.buttonLabel, { color: c.surface }]}>Try again</Text>
      </Pressable>
    </View>
  )
}

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) return <ErrorFallback error={this.state.error} onRetry={this.reset} />
    return this.props.children
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  message: { fontSize: 14, textAlign: 'center' },
  button: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  buttonLabel: { fontSize: 16, fontWeight: '700' },
})
