"""Shared configuration for synthetic employee/salary data generation.

Kept separate from the generator functions so the pool of names,
departments, and country/currency/salary profiles can be extended without
touching generation logic (see `employee_generator.py`, `salary_generator.py`).
"""

from typing import NamedTuple

# A clearly-synthetic domain, so generated emails are never mistaken for
# real addresses.
EMAIL_DOMAIN = "payscope-example.com"

FIRST_NAMES = (
    "Ada", "Grace", "Alan", "Linus", "Margaret", "John", "Katherine", "Dennis",
    "Barbara", "Donald", "Radia", "Vint", "Frances", "Edsger", "Shafi",
    "Jean", "Guido", "Anita", "Tim", "Hedy", "Claude", "Marissa", "Satya",
    "Sundar", "Priya", "Wei", "Hiroshi", "Fatima", "Carlos", "Elena",
)

LAST_NAMES = (
    "Lovelace", "Hopper", "Turing", "Torvalds", "Hamilton", "McCarthy",
    "Johnson", "Ritchie", "Liskov", "Knuth", "Perlman", "Cerf", "Allen",
    "Dijkstra", "Goldwasser", "Bartik", "van Rossum", "Borg", "Berners-Lee",
    "Lamarr", "Shannon", "Mayer", "Nadella", "Pichai", "Sharma", "Zhang",
    "Tanaka", "Al-Farsi", "Garcia", "Petrova",
)

DEPARTMENTS = (
    "Engineering",
    "Sales",
    "Marketing",
    "Human Resources",
    "Finance",
    "Operations",
    "Customer Support",
    "Product",
    "Legal",
    "IT",
)

JOB_TITLES_BY_DEPARTMENT: dict[str, tuple[str, ...]] = {
    "Engineering": ("Software Engineer", "Senior Software Engineer", "Engineering Manager", "QA Engineer"),
    "Sales": ("Sales Representative", "Account Executive", "Sales Manager", "Business Development Rep"),
    "Marketing": ("Marketing Specialist", "Content Strategist", "Marketing Manager", "SEO Analyst"),
    "Human Resources": ("HR Generalist", "Recruiter", "HR Manager", "People Operations Specialist"),
    "Finance": ("Financial Analyst", "Accountant", "Finance Manager", "Payroll Specialist"),
    "Operations": ("Operations Analyst", "Operations Manager", "Logistics Coordinator", "Process Specialist"),
    "Customer Support": ("Support Agent", "Customer Success Manager", "Support Team Lead", "Technical Support Engineer"),
    "Product": ("Product Manager", "Product Analyst", "UX Researcher", "Product Designer"),
    "Legal": ("Legal Counsel", "Paralegal", "Compliance Officer", "Contracts Manager"),
    "IT": ("IT Support Specialist", "Systems Administrator", "Network Engineer", "IT Manager"),
}


class CountrySalaryProfile(NamedTuple):
    """A country's currency and a realistic annual salary range in it."""

    country: str
    currency: str
    min_annual_salary: int
    max_annual_salary: int


COUNTRY_SALARY_PROFILES = (
    CountrySalaryProfile("United Kingdom", "GBP", 28_000, 120_000),
    CountrySalaryProfile("United States", "USD", 40_000, 190_000),
    CountrySalaryProfile("Germany", "EUR", 35_000, 130_000),
    CountrySalaryProfile("India", "INR", 300_000, 3_200_000),
    CountrySalaryProfile("Japan", "JPY", 3_200_000, 12_500_000),
    CountrySalaryProfile("Canada", "CAD", 42_000, 155_000),
    CountrySalaryProfile("Australia", "AUD", 48_000, 165_000),
    CountrySalaryProfile("Singapore", "SGD", 42_000, 150_000),
)

COUNTRIES = tuple(profile.country for profile in COUNTRY_SALARY_PROFILES)

COUNTRY_SALARY_PROFILE_BY_NAME = {profile.country: profile for profile in COUNTRY_SALARY_PROFILES}
