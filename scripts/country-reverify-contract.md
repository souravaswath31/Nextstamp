# Refreshing a country guide's entry rules (one agent per country)

Read `scripts/content-research-contract.md` (sources, banned sites, budget, rules for `null`) and
the "never fabricate a fact" section of `CLAUDE.md` first. **There is no human review after you.**

1. `cd /Users/sourav/Downloads/nextstamp-app && python3 scripts/reverify_country.py brief "<country>"`
   prints the entry-critical fields as they stand. They are **claims to test**, not facts to keep.
2. Re-check each against an official page you open today (the destination's immigration/foreign
   ministry/health ministry/tourism board; UK FCDO, Global Affairs Canada, US State Dept,
   Smartraveller, CDC/WHO as stated fallbacks): passport validity rule (and whether it counts from
   entry or exit), blank pages, onward-ticket requirement (tri-state: true / false / null), entry
   formalities and authorisations in force today (ETA/e-visa, arrival card, health declaration,
   currency declaration), required vaccinations (yellow fever etc.), malaria advice, emergency
   numbers. Where the built-in browser tools (`mcp__Claude_Browser__*`) get through pages the fetch
   tool cannot, use them; read public pages only, never log in, never bypass a captcha.
3. Write a patch with ONLY the fields you re-checked and found changed or newly sourced:
   `{"country": "<name>", "last_verified_date": "<today>", "fields": { ... }}`. Fields allowed:
   passport_validity_rule, passport_validity_months_beyond_entry, passport_validity_basis (entry |
   exit | duration-of-stay | none), blank_pages_required, onward_ticket_required,
   entry_requirement_notes, passport_source_url, health {required_vaccinations,
   recommended_vaccinations, malaria_risk, notes, source_url}, emergency {...}, sources (REPLACES
   the list: keep the old URLs that remain cited). Nested `health`/`emergency` objects merge by key.
4. If every field re-checks unchanged, write a patch with an empty `fields` object (this just bumps
   the date, which is honest only if you did confirm each field today). Leave out a field you could
   not confirm.
5. A fact that cannot be confirmed stays as it is or becomes `null`; never present memory as sourced.
   Two official sources that disagree: best-supported value in the field, the other named in notes.

Self-check (writes nothing): `python3 scripts/reverify_country.py apply --dry-run <patch.json>`.
Write the patch to the path in your task. Report under 150 words: per field, unchanged / changed
(quote the line) / left alone (why).
