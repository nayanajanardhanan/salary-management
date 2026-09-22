import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorMessage } from './ErrorMessage'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

/**
 * Catches render-time errors anywhere in the component tree below it so a
 * single failing component doesn't blank the whole app. Data-fetch errors
 * (network/API failures) are a separate, expected state handled by
 * `ErrorMessage` directly in each view, not by this boundary.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Unhandled UI error:', error, errorInfo)
  }

  private handleReset = (): void => {
    this.setState({ hasError: false })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <ErrorMessage
          message="Something went wrong while displaying this page."
          onRetry={this.handleReset}
        />
      )
    }

    return this.props.children
  }
}
