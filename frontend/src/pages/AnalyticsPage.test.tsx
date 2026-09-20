import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as analyticsApi from '../api/analytics'
import { ApiError } from '../api/client'
import type { SalaryStatistics } from '../types/analytics'
import { AnalyticsPage } from './AnalyticsPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <AnalyticsPage />
    </MemoryRouter>,
  )
}

const populatedStatistics: SalaryStatistics = {
  overall: [
    { currency: 'GBP', count: 2, average: '97500.00', minimum: '95000.00', maximum: '100000.00' },
    { currency: 'USD', count: 1, average: '105000.00', minimum: '105000.00', maximum: '105000.00' },
  ],
  by_department: [
    {
      department: 'Engineering',
      currency: 'GBP',
      count: 2,
      average: '97500.00',
      minimum: '95000.00',
      maximum: '100000.00',
    },
    {
      department: 'Research',
      currency: 'USD',
      count: 1,
      average: '105000.00',
      minimum: '105000.00',
      maximum: '105000.00',
    },
  ],
  by_country: [
    {
      country: 'United Kingdom',
      currency: 'GBP',
      count: 2,
      average: '97500.00',
      minimum: '95000.00',
      maximum: '100000.00',
    },
    {
      country: 'United States',
      currency: 'USD',
      count: 1,
      average: '105000.00',
      minimum: '105000.00',
      maximum: '105000.00',
    },
  ],
}

const emptyStatistics: SalaryStatistics = { overall: [], by_department: [], by_country: [] }

describe('AnalyticsPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows an accessible loading state while the request is in flight', () => {
    vi.spyOn(analyticsApi, 'fetchSalaryStatistics').mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status')).toHaveTextContent(/loading/i)
  })

  it('renders overall salary statistics per currency, correctly formatted', async () => {
    vi.spyOn(analyticsApi, 'fetchSalaryStatistics').mockResolvedValue(populatedStatistics)

    renderPage()

    const gbpCard = await screen.findByRole('group', { name: 'Salary statistics in GBP' })
    expect(within(gbpCard).getByText('2')).toBeInTheDocument()
    expect(within(gbpCard).getByText(/97,500\.00/)).toBeInTheDocument()
    expect(within(gbpCard).getByText(/95,000\.00/)).toBeInTheDocument()
    expect(within(gbpCard).getByText(/100,000\.00/)).toBeInTheDocument()

    const usdCard = screen.getByRole('group', { name: 'Salary statistics in USD' })
    expect(within(usdCard).getAllByText(/105,000\.00/).length).toBeGreaterThan(0)
  })

  it('renders salary statistics grouped by department in an accessible table', async () => {
    vi.spyOn(analyticsApi, 'fetchSalaryStatistics').mockResolvedValue(populatedStatistics)

    renderPage()

    const table = await screen.findByRole('table', { name: /salary statistics by department/i })
    expect(within(table).getByRole('columnheader', { name: 'Department' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Currency' })).toBeInTheDocument()
    expect(within(table).getByRole('row', { name: /Engineering/ })).toHaveTextContent('GBP')
    expect(within(table).getByRole('row', { name: /Research/ })).toHaveTextContent('USD')
  })

  it('renders salary statistics grouped by country in an accessible table', async () => {
    vi.spyOn(analyticsApi, 'fetchSalaryStatistics').mockResolvedValue(populatedStatistics)

    renderPage()

    const table = await screen.findByRole('table', { name: /salary statistics by country/i })
    expect(within(table).getByRole('columnheader', { name: 'Country' })).toBeInTheDocument()
    expect(within(table).getByRole('row', { name: /United Kingdom/ })).toHaveTextContent('GBP')
    expect(within(table).getByRole('row', { name: /United States/ })).toHaveTextContent('USD')
  })

  it('renders accessible department, country, and currency filter controls', async () => {
    vi.spyOn(analyticsApi, 'fetchSalaryStatistics').mockResolvedValue(populatedStatistics)

    renderPage()
    await screen.findByRole('group', { name: 'Salary statistics in GBP' })

    const departmentSelect = screen.getByLabelText('Department')
    const countrySelect = screen.getByLabelText('Country')
    const currencySelect = screen.getByLabelText('Currency')

    expect(within(departmentSelect).getByText('Engineering')).toBeInTheDocument()
    expect(within(countrySelect).getByText('United Kingdom')).toBeInTheDocument()
    expect(within(currencySelect).getByText('GBP')).toBeInTheDocument()
    expect(within(currencySelect).getByText('USD')).toBeInTheDocument()
  })

  it('filters by department, sending the correct query parameter', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(analyticsApi, 'fetchSalaryStatistics').mockResolvedValue(populatedStatistics)

    renderPage()
    await screen.findByRole('group', { name: 'Salary statistics in GBP' })

    spy.mockResolvedValueOnce({
      overall: [populatedStatistics.overall[0]],
      by_department: [populatedStatistics.by_department[0]],
      by_country: [populatedStatistics.by_country[0]],
    })
    await user.selectOptions(screen.getByLabelText('Department'), 'Engineering')

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith({ department: 'Engineering', country: '', currency: '' }),
    )
  })

  it('filters by country, sending the correct query parameter', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(analyticsApi, 'fetchSalaryStatistics').mockResolvedValue(populatedStatistics)

    renderPage()
    await screen.findByRole('group', { name: 'Salary statistics in GBP' })

    await user.selectOptions(screen.getByLabelText('Country'), 'United States')

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith({ department: '', country: 'United States', currency: '' }),
    )
  })

  it('filters by currency, sending the correct query parameter', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(analyticsApi, 'fetchSalaryStatistics').mockResolvedValue(populatedStatistics)

    renderPage()
    await screen.findByRole('group', { name: 'Salary statistics in GBP' })

    await user.selectOptions(screen.getByLabelText('Currency'), 'GBP')

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith({ department: '', country: '', currency: 'GBP' }),
    )
  })

  it('combines department, country, and currency filters', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(analyticsApi, 'fetchSalaryStatistics').mockResolvedValue(populatedStatistics)

    renderPage()
    await screen.findByRole('group', { name: 'Salary statistics in GBP' })

    await user.selectOptions(screen.getByLabelText('Department'), 'Engineering')
    await user.selectOptions(screen.getByLabelText('Country'), 'United Kingdom')
    await user.selectOptions(screen.getByLabelText('Currency'), 'GBP')

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith({
        department: 'Engineering',
        country: 'United Kingdom',
        currency: 'GBP',
      }),
    )
  })

  it('clears filters via the "Clear filters" action', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(analyticsApi, 'fetchSalaryStatistics').mockResolvedValue(populatedStatistics)

    renderPage()
    await screen.findByRole('group', { name: 'Salary statistics in GBP' })

    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Department'), 'Engineering')
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith({ department: '', country: '', currency: '' }),
    )
    expect(screen.getByLabelText('Department')).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()
  })

  it('shows an accessible message when no salary records match the active filters', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(analyticsApi, 'fetchSalaryStatistics').mockResolvedValue(populatedStatistics)

    renderPage()
    await screen.findByRole('group', { name: 'Salary statistics in GBP' })

    spy.mockResolvedValueOnce(emptyStatistics)
    await user.selectOptions(screen.getByLabelText('Department'), 'Engineering')

    await waitFor(() => expect(screen.getByText(/no salary records match/i)).toBeInTheDocument())
    expect(screen.getByText(/department "Engineering"/)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows a safe, accessible error state for API failures, without exposing internals', async () => {
    vi.spyOn(analyticsApi, 'fetchSalaryStatistics').mockRejectedValue(
      new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.'),
    )

    renderPage()

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('Something went wrong. Please try again.')).toBeInTheDocument()
    expect(screen.queryByText(/traceback|stack|internal_error/i)).not.toBeInTheDocument()
  })

  it('handles an unauthorized response without crashing, via the existing error state', async () => {
    vi.spyOn(analyticsApi, 'fetchSalaryStatistics').mockRejectedValue(
      new ApiError(401, 'UNAUTHORIZED', 'Missing or invalid authentication credentials.'),
    )

    renderPage()

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('Missing or invalid authentication credentials.')).toBeInTheDocument()
  })

  it('retries the request from the error state', async () => {
    const user = userEvent.setup()
    const spy = vi
      .spyOn(analyticsApi, 'fetchSalaryStatistics')
      .mockRejectedValue(new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.'))

    renderPage()

    await screen.findByRole('alert')

    spy.mockResolvedValueOnce(populatedStatistics)
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() =>
      expect(screen.getByRole('group', { name: 'Salary statistics in GBP' })).toBeInTheDocument(),
    )
  })
})
