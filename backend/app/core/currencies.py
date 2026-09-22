"""The "known, supported set of currency codes" `docs/requirements.md` FR-7.3
requires salary currency values to conform to.

Sourced from the ISO 4217 standard's active currency & funds code list
(https://www.iso.org/iso-4217-currency-codes.html; cross-checked against
https://datahub.io/core/currency-codes, which republishes the same table
as structured data), filtered to active codes only (no withdrawal date)
and then restricted to real national/regional currencies — i.e. excluding:

- precious-metal codes (XAU, XAG, XPD, XPT);
- bond-market/index units (e.g. BOV, CHE, CHW, CLF, COU, MXV, USN, UYI,
  UYW, XBA, XBB, XBC, XBD);
- special drawing rights / accounting units (XAD, XDR, XSU, XUA);
- the reserved testing / no-currency codes (XTS, XXX).

None of the excluded codes is something an employer could plausibly
denominate a salary in, so keeping them out of the "supported" set is a
direct reading of FR-7.3 ("a known, supported set of currency codes"),
not a narrower, invented restriction — every currency already used by
`app.data_generation.constants.COUNTRY_SALARY_PROFILES` (GBP, USD, EUR,
INR, JPY, CAD, AUD, SGD) is included here.
"""

SUPPORTED_CURRENCY_CODES: frozenset[str] = frozenset(
    {
        "AED", "AFN", "ALL", "AMD", "AOA", "ARS", "AUD", "AWG", "AZN", "BAM",
        "BBD", "BDT", "BHD", "BIF", "BMD", "BND", "BOB", "BRL", "BSD", "BTN",
        "BWP", "BYN", "BZD", "CAD", "CDF", "CHF", "CLP", "CNY", "COP", "CRC",
        "CUP", "CVE", "CZK", "DJF", "DKK", "DOP", "DZD", "EGP", "ERN", "ETB",
        "EUR", "FJD", "FKP", "GBP", "GEL", "GHS", "GIP", "GMD", "GNF", "GTQ",
        "GYD", "HKD", "HNL", "HTG", "HUF", "IDR", "ILS", "INR", "IQD", "IRR",
        "ISK", "JMD", "JOD", "JPY", "KES", "KGS", "KHR", "KMF", "KPW", "KRW",
        "KWD", "KYD", "KZT", "LAK", "LBP", "LKR", "LRD", "LSL", "LYD", "MAD",
        "MDL", "MGA", "MKD", "MMK", "MNT", "MOP", "MRU", "MUR", "MVR", "MWK",
        "MXN", "MYR", "MZN", "NAD", "NGN", "NIO", "NOK", "NPR", "NZD", "OMR",
        "PAB", "PEN", "PGK", "PHP", "PKR", "PLN", "PYG", "QAR", "RON", "RSD",
        "RUB", "RWF", "SAR", "SBD", "SCR", "SDG", "SEK", "SGD", "SHP", "SLE",
        "SOS", "SRD", "SSP", "STN", "SVC", "SYP", "SZL", "THB", "TJS", "TMT",
        "TND", "TOP", "TRY", "TTD", "TWD", "TZS", "UAH", "UGX", "USD", "UYU",
        "UZS", "VED", "VES", "VND", "VUV", "WST", "XAF", "XCD", "XCG", "XOF",
        "XPF", "YER", "ZAR", "ZMW", "ZWG",
    }
)
