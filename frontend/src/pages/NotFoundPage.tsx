import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function NotFoundPage() {
  useDocumentTitle('Page not found - PayScope')

  return (
    <section aria-labelledby="not-found-heading" className="not-found-page">
      <span className="not-found-page__code">404</span>
      <h1 id="not-found-heading">Page not found</h1>
      <p>The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn btn-primary">
        Return to home
      </Link>
    </section>
  )
}
