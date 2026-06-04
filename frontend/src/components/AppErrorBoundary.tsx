import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('App render error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            margin: 24,
            padding: 20,
            fontFamily: 'system-ui, sans-serif',
            color: '#1b3d1b',
            background: '#fff3f3',
            border: '1px solid #c62828',
            borderRadius: 8,
          }}
        >
          <h2 style={{ margin: '0 0 12px', color: '#c62828' }}>Application error</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{this.state.error.message}</pre>
          <p style={{ marginTop: 16, fontSize: 14 }}>
            Open the browser console (F12) for details, then reload the page.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}
