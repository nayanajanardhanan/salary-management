import { useEffect } from 'react'

/** Sets the document title for the active page, restoring the previous title on unmount. */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previousTitle = document.title
    document.title = title
    return () => {
      document.title = previousTitle
    }
  }, [title])
}
