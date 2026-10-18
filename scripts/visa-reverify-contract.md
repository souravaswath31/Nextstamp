# Re-verifying existing visa rules (one agent per destination)

Handed to each agent with a destination name. Read `scripts/content-research-contract.md`
(sources, banned sites, budget, the ETA/e-visa mapping) and the "never fabricate a fact"
section of `CLAUDE.md` first. **There is no human review after you.**

## The job
Get the current rules for entering your destination, for each passport on file, and decide
whether each existing rule is still right.

1. `cd /Users/sourav/Downloads/nextstamp-app && python3 scripts/reverify_visa.py brief "<destination>"`
   prints the existing rules (JSON). They are **claims to test, not facts to preserve.** Do not
   skim them and re-date them.
2. For each rule, open an official source (the destination's immigration / foreign ministry /
   e-visa portal, or the passport holder's own government travel advice as a fallback: UK FCDO,
   Global Affairs Canada, US State Dept, Australia Smartraveller) and check: visa type, the
   stay length, conditions, fee, whether an authorisation scheme (ETA / e-visa / arrival card /
   declaration) has started, ended or changed. Compare with what the rule says.
3. Write the corrected rule object (all nine fields, same shape as `data/visa-rules-seed.json`)
   with `last_verified_date` = today (`date +%F`):
   - **Unchanged and you confirmed it from a page you opened today**: include it with the new
     date. Keep the text; tighten it only if something is wrong or unclear.
   - **Changed**: rewrite `visa_type`, `max_stay_days`, `conditions_text`, `fee_notes`, `source_url`
     to match the source, and make `conditions_text` state what is in force *today*.
   - **Could not reach a source that settles it**: leave the rule OUT of your file. It keeps its
     old date, which is the honest state. Say so in your report.
   - **A genuinely new cascade** (documented "visa-free/e-visa if you hold a valid X visa"): add a
     row with `requires_held_document_country` set. Mention it in the report.
4. `source_url` must be a page you opened that says the thing; never a banned source. The rule
   key (passport_country, destination_country, requires_held_document_country) must not change.

## Output and self-check
Write ONE JSON array (no markdown fences) to the path in your task, early and rewrite as you go.
Self-check (writes nothing):
`python3 scripts/reverify_visa.py apply --dry-run <your-file.json>`
It prints CHANGED for substantive differences, and rejects a bad source or a malformed rule.

## Report (under 200 words)
Per passport: re-confirmed / changed (what and why) / left out (why). Quote the line of the
official page for every CHANGED rule. Say which sources you read directly and which came from a
search snippet.
