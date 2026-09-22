# PayScope — Requirements Document

## 1. Product Overview

### 1.1 Purpose

PayScope is a web-based employee salary management application. It gives HR
managers a single, structured, authenticated place to create, view, update,
and remove employee and salary records, and to analyze compensation across
departments and countries, replacing manual spreadsheet-based tracking.
PayScope is designed for an organization on the order of **10,000
employees**.

### 1.2 Problem It Solves

Organizations with a large, distributed workforce often manage salary data in
spreadsheets. This approach does not scale well: it is slow to search, error
prone to filter, difficult to keep consistent, and awkward to summarize
across dimensions such as department or country. PayScope addresses this by
providing a purpose-built application for browsing, searching, filtering, and
analyzing salary data.

### 1.3 Target User

The primary user is the **HR Manager**, who needs to:

* Look up individual employees and their salary details.
* Search and filter the employee population by various criteria.
* Understand salary distribution and trends across the organization.

PayScope is designed for internal, authenticated use by HR staff, not for
employee self-service.

---

## 2. User Stories

1. **View employee salary records**
   As an HR manager, I want to view a list of employees along with their
   salary details, so that I can review individual compensation information.

1a. **Sign in**
   As an HR manager, I want to sign in with my username or email and
   password, so that only authorized HR staff can access employee and
   salary data.

1b. **Manage employee records**
   As an HR manager, I want to create, update, and remove employee records,
   so that the system reflects who is currently employed and their current
   attributes.

1c. **Manage salary records**
   As an HR manager, I want to create, update, and remove an employee's
   salary record, so that I can keep their current compensation accurate.

2. **Search employees**
   As an HR manager, I want to search for employees by attributes such as
   name or employee ID, so that I can quickly locate a specific employee
   without scanning the full list.

3. **Filter employees**
   As an HR manager, I want to filter employees by attributes such as
   department, country, and salary range, so that I can narrow down the
   employee list to a relevant subset.

4. **View paginated employee records**
   As an HR manager, I want employee records to be presented in pages, so
   that I can browse a large employee list without long load times or an
   overwhelming amount of data on screen.

5. **View salary analytics**
   As an HR manager, I want to see summary statistics about salaries (such as
   counts, averages, and ranges), so that I can understand overall
   compensation patterns without manually reviewing every record.

6. **Analyze salary information by country and department**
   As an HR manager, I want to view salary analytics grouped by country and
   by department, so that I can compare compensation patterns across
   organizational units and locations.

---

## 3. Functional Requirements

### 3.0 Authentication

* FR-0.1: The system shall require an HR manager to sign in with a username
  or email and password before any employee, salary, or analytics data is
  accessible.
* FR-0.2: The system shall issue a time-limited access token (JWT) on
  successful sign-in and require it on every employee, salary, and analytics
  request.
* FR-0.3: The system shall reject requests with a missing, invalid, or
  expired token, and reject sign-in attempts with an incorrect username/email
  or password, without revealing which part of the credential was wrong.
* FR-0.4: The system shall store passwords only in hashed form; passwords
  shall never be stored or logged in plain text.

### 3.1 Employee Information

* FR-1.1: The system shall store the following core attributes for each
  employee: a unique employee identifier, full name, department, country,
  job title, and employment status.
* FR-1.2: The system shall allow an HR manager to view the details of a
  single employee.
* FR-1.3: The system shall allow an HR manager to view a list of all
  employees.
* FR-1.4: The system shall allow an HR manager to create a new employee
  record.
* FR-1.5: The system shall allow an HR manager to update an existing
  employee record's attributes.
* FR-1.6: The system shall allow an HR manager to delete an employee record.
  Deleting an employee also removes that employee's salary record, since a
  salary record cannot exist without an associated employee.

### 3.2 Salary Information

* FR-2.1: The system shall store, for each employee, a salary amount and the
  currency in which that salary is denominated (see Section 5).
* FR-2.2: The system shall associate at most one active salary record with
  each employee; this is enforced as a database-level uniqueness constraint,
  not only an application-level check. Salary history is deliberately out of
  scope (see Section 5.4 and Section 6.2).
* FR-2.3: The system shall display an employee's salary together with its
  currency wherever a salary value is shown.
* FR-2.4: The system shall allow an HR manager to create a salary record for
  an employee who does not yet have one.
* FR-2.5: The system shall allow an HR manager to update an employee's
  existing salary record (amount and/or currency).
* FR-2.6: The system shall allow an HR manager to delete an employee's
  salary record without deleting the employee.
* FR-2.7: The system shall reject an attempt to create a second salary
  record for an employee who already has one, rather than silently
  replacing or duplicating it.

### 3.3 Search

* FR-3.1: The system shall allow searching employees by name and/or employee
  identifier.
* FR-3.2: Search shall be case-insensitive and match partial input (e.g.
  substring match on name).
* FR-3.3: If no employees match the search criteria, the system shall
  clearly indicate that no results were found.

### 3.4 Filtering

* FR-4.1: The system shall allow filtering employees by department.
* FR-4.2: The system shall allow filtering employees by country.
* FR-4.3: The system shall allow filtering employees by a salary range
  (minimum and/or maximum), scoped to a single currency at a time (see
  Section 5).
* FR-4.4: The system shall allow multiple filters to be applied together
  (e.g. department and country simultaneously).
* FR-4.5: The system shall allow search and filters to be combined.

### 3.5 Pagination

* FR-5.1: The system shall return employee records in pages rather than as a
  single unbounded list.
* FR-5.2: The system shall allow the HR manager to navigate between pages
  (e.g. next, previous, or a specific page number).
* FR-5.3: The system shall indicate the total number of matching records
  and/or total number of pages available.
* FR-5.4: Pagination shall apply consistently on top of any active search
  and filter criteria.

### 3.6 Salary Analytics

* FR-6.1: The system shall provide summary statistics for salaries,
  including at minimum: count of employees, average salary, minimum salary,
  and maximum salary.
* FR-6.2: The system shall provide the above summary statistics grouped by
  department.
* FR-6.3: The system shall provide the above summary statistics grouped by
  country.
* FR-6.4: All salary analytics shall be computed and presented on a
  single-currency basis, as described in Section 5. The system shall clearly
  label which currency a given analytics figure applies to.
* FR-6.5: Analytics views shall reflect any active filters where applicable
  (e.g. analytics for a filtered subset of employees), except where noted as
  a future enhancement.

### 3.7 Data Validation

* FR-7.1: The system shall require core employee fields (name, department,
  country, salary amount, salary currency) to be present and non-empty when
  creating or importing an employee record.
* FR-7.2: The system shall validate that salary amounts are numeric and
  non-negative.
* FR-7.3: The system shall validate that salary currency values conform to a
  known, supported set of currency codes (see Section 5).
* FR-7.4: The system shall reject or flag records that fail validation
  rather than silently storing invalid data.

### 3.8 Error Handling

* FR-8.1: The system shall present a clear, user-understandable message when
  a request fails (e.g. network error, server error, invalid input).
* FR-8.2: The system shall distinguish between "no results found" (a valid
  empty state) and "an error occurred" (a failure state).
* FR-8.3: The system shall not expose internal technical details (e.g. stack
  traces, raw database errors) to the end user.
* FR-8.4: The system shall log errors on the server side with enough detail
  to support troubleshooting (see Section 4.7).

---

## 4. Non-Functional Requirements

### 4.1 Maintainability

* The codebase shall be organized so that individual features (search,
  filtering, pagination, analytics) can be modified independently with
  minimal cross-impact.
* Code shall follow consistent conventions to support long-term maintenance
  by multiple contributors.

### 4.2 Scalability

* The system shall be designed to handle a dataset of approximately 10,000
  employee records without significant degradation in usability.
* Search, filtering, pagination, and analytics operations shall be designed
  to operate efficiently at this data volume (e.g. via appropriate indexing
  and server-side computation rather than loading all records into the
  client).

### 4.3 Performance

* Common interactions (viewing a page of employees, applying a search or
  filter, viewing analytics) shall complete within a time frame that feels
  responsive to an interactive user at the target data volume of ~10,000
  records.
* Pagination and filtering shall be performed server-side to avoid
  transferring the full dataset to the client.

### 4.4 Security

* Access to employee and salary data shall require authentication.
* The system shall not expose salary data through unauthenticated endpoints.
* Input from the client (search terms, filter values) shall be validated and
  sanitized on the server before use.

### 4.5 Testability

* Functional requirements (search, filtering, pagination, analytics
  calculations, validation rules) shall be covered by automated tests.
* The system's components shall be structured to allow logic to be tested
  independently of the user interface where practical.

### 4.6 Accessibility

* The user interface shall follow basic accessibility practices, including
  keyboard navigability, sufficient color contrast, and appropriate labeling
  of interactive elements (e.g. search and filter controls).

### 4.7 Observability and Error Logging

* The system shall log server-side errors, including enough context (e.g.
  timestamp, request context) to support diagnosis.
* The system shall distinguish, in logs, between expected conditions (e.g.
  validation failures) and unexpected failures (e.g. unhandled exceptions).

---

## 5. Salary and Currency Considerations

Because employees may belong to different countries, salary values may be
denominated in different currencies. This has direct implications for how
salary data is stored and aggregated:

* **No implicit cross-currency addition.** Salary values in different
  currencies shall never be summed, averaged, or otherwise combined directly
  without an explicit, documented conversion step. A raw sum of, for
  example, USD and INR salary values is not a meaningful figure and shall
  not be presented as one.

* **Currency storage.** Each salary record shall store its currency
  explicitly alongside the amount (e.g. an amount and a currency code such
  as an ISO 4217 code). Currency is a required attribute of every salary
  record, not an assumed default.

* **Currency-specific summaries vs. cross-currency reporting.** The system
  distinguishes between two kinds of salary analytics:
  * *Currency-specific summaries*: aggregations (count, average, min, max)
    computed only across employees sharing the same salary currency. These
    are supported in the initial version.
  * *Cross-currency reporting*: aggregations that combine salary figures
    originally in different currencies into a single reporting figure (e.g.
    a converted "total compensation" across all countries). This requires an
    explicit currency conversion mechanism (e.g. exchange rates) and
    associated decisions about conversion timing and rate source.

* **Reporting currency limitation.** A unified reporting currency and
  currency conversion are **not implemented in the initial version**. Where
  employees are grouped by country or department, analytics shall either be
  scoped to a single currency at a time or presented per currency group,
  rather than combined into one converted figure. This limitation shall
  remain visible in the product (e.g. through labeling) rather than hidden
  or silently approximated.

### 5.4 One Active Salary Per Employee (Salary Data Model and Scope Decision)

* Each employee has **at most one active salary record** at any time. This
  is enforced as a database-level uniqueness constraint on the employee-to-
  salary relationship, not only as an application-level check, so a second
  salary record for the same employee cannot be created even by a direct
  database write.
* **Salary history — tracking or versioning how an employee's salary has
  changed over time — is deliberately excluded from this system.** Updating
  an employee's salary overwrites the current amount/currency; the previous
  value is not retained or queryable. This keeps the data model, the API,
  and the analytics simple and matches the currently defined product need
  (understanding *current* compensation), not a historical or audit trail.
* This exclusion is not treated as an incomplete feature: no partial
  history mechanism exists anywhere in the system (database, API, or
  frontend). It is listed as a **potential future enhancement** (Section
  6.3), should a documented need for compensation-change tracking arise
  later.

---

## 6. Scope

### 6.1 In Scope (Current Version)

* HR authentication (username/email and password, JWT-based) required for
  all employee, salary, and analytics access.
* Creating, viewing, updating, and deleting employee records.
* Creating, viewing, updating, and deleting an employee's salary record
  (with at most one active salary per employee).
* Searching employees by name and/or employee identifier.
* Filtering employees by department, country, and salary range (single
  currency at a time).
* Sorting employee and salary listings.
* Paginated browsing of employee records.
* Salary analytics: overall, by department, and by country, computed within
  a single currency at a time.
* Basic data validation on employee and salary fields.
* Basic error handling and server-side error logging.

### 6.2 Out of Scope (Current Version)

* Cross-currency reporting and currency conversion.
* Salary history / tracking or versioning changes to an employee's salary
  over time (see Section 5.4). Updating a salary overwrites the current
  value; the previous value is not retained.
* Payroll processing, tax calculations, or benefits administration.
* Employee self-service access.
* Role-based permission tiers beyond a single authenticated HR manager role.
* Notifications, exports, or scheduled reports.
* Multi-language / localization support.

### 6.3 Potential Future Enhancements

* Currency conversion with a configurable reporting currency.
* Salary history and trend-over-time analytics.
* Additional roles and permission levels (e.g. read-only vs. administrative
  access).
* Data export (e.g. CSV) of filtered results or analytics.
* Bulk import/update tooling for employee and salary data.
* Additional analytics dimensions (e.g. by job title, tenure, or employment
  status).

---

## 7. Assumptions and Constraints

* Individual employee and salary records can be created, updated, and
  deleted through the application itself (Sections 3.1–3.2). Bulk initial
  population of a large dataset (e.g. the ~10,000-employee target scale) is
  expected to happen via a separate seed/import process, not by creating
  10,000 records one at a time through the UI.
* It is assumed that each employee has exactly one country, one department,
  and at most one active salary at a time.
* It is assumed that a single, fixed reporting currency is not required for
  the current version, per Section 5.
* It is assumed that all users of the application are internal HR staff,
  authenticated via the application's own username/email and password login
  (Section 3.0); there is no separate external identity provider.
* It is assumed that the target dataset size is on the order of 10,000
  employees, and non-functional requirements are scoped to that volume
  rather than arbitrarily larger scales.
* This document describes product functionality independent of specific
  implementation technology; see `docs/architecture.md` for the actual
  technical architecture and stack.

---

## 8. Acceptance Criteria

1. **Employee listing**: Given a populated dataset, an HR manager can
   retrieve a list of employees and see, for each employee, at minimum
   name, department, country, and salary (amount and currency).

2. **Search**: Given a search term matching part of an employee's name or
   employee identifier, the system returns only employees matching that
   term; given a term matching no employee, the system indicates zero
   results without error.

3. **Filtering**: Given a filter by department, country, or salary range
   (single currency), the system returns only employees satisfying all
   active filter criteria; combining search with filters returns only
   employees satisfying both.

4. **Pagination**: Given a dataset larger than one page, the system returns
   a bounded subset of records per request along with the total count
   and/or page count, and successive page requests return non-overlapping
   sets of records that together cover all matching employees.

5. **Salary analytics**: Given a set of employees sharing a single salary
   currency, the system returns correct count, average, minimum, and
   maximum salary figures for that set, both overall and grouped by
   department and by country; figures are labeled with their currency.

6. **Currency integrity**: The system never presents a combined salary
   figure that sums or averages amounts across different currencies without
   explicit conversion; where cross-currency combination would otherwise be
   implied, the system instead presents per-currency figures.

7. **Validation**: Given an employee/salary record missing a required field,
   containing a negative salary amount, or containing an unrecognized
   currency code, the system rejects or flags the record rather than
   storing it as valid data.

8. **Error handling**: Given a server-side failure during a request, the
   system displays a user-understandable error message (not a raw technical
   error) and logs the underlying error server-side.

9. **Scale**: Given a dataset of approximately 10,000 employees, listing,
   search, filtering, pagination, and analytics operations remain
   functionally correct and usable (i.e. do not require loading the entire
   dataset into the client at once).

10. **Access control**: Given an unauthenticated request, the system does
    not return employee or salary data.

11. **Sign-in**: Given a correct username/email and password, the system
    issues an access token that is accepted on subsequent employee, salary,
    and analytics requests; given an incorrect username/email or password,
    the system rejects the sign-in without indicating which part was wrong.

12. **Employee lifecycle**: An HR manager can create an employee record,
    retrieve it, update its attributes, and delete it; after deletion, the
    employee (and any associated salary record) is no longer returned by
    the system.

13. **Salary lifecycle and uniqueness**: An HR manager can create a salary
    record for an employee who does not have one, update it, and delete it.
    An attempt to create a second salary record for an employee who already
    has one is rejected, and the existing record is left unchanged.
