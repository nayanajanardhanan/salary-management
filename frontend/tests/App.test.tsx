import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../src/App'

describe('App', () => {
  it('renders the home page at the root route', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: 'PayScope' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
  })

  it('renders the skip link as the first focusable element', () => {
    render(<App />)

    expect(screen.getByRole('link', { name: 'Skip to main content' })).toBeInTheDocument()
  })
})
