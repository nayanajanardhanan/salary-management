import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function HomePage() {
  useDocumentTitle('PayScope')

  return (
    <section aria-labelledby="home-heading">
      <h1 id="home-heading">PayScope</h1>
      <p>Employee salary management for HR managers.</p>
      <p>Employee listing, search, filtering, and salary analytics will appear here.</p>
    </section>
  )
}
