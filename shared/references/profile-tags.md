# Profile tags

`.acdev/profile.json` names what the project actually has, so the layer
checklists can drop the items that cannot apply. `blueprint` writes it
from the ADRs (from `shared/references/templates/profile.json`); `onboard`
writes it from the situation map. A checklist item that opens with
`[tag]` or `[tag,other]` applies only when the profile carries one of
those tags; an untagged item always applies. Without a profile file every
item applies, so filtering can only ever remove what the project declared
it does not have.

`node "<plugin-root>/scripts/acdev.mjs" checklist --layers api,data`
prints the filtered result; `pack --layers` includes it.

| Tag | The project has... |
|---|---|
| `auth` | Authentication or authorization: users, sessions, roles, a permission matrix |
| `multi-tenant` | More than one tenant sharing the system (row-level or schema isolation) |
| `payments` | Money moving: charges, refunds, invoices that are paid through the product |
| `pii` | Personal data stored (names, emails, addresses, identifiers) |
| `compliance` | A compliance ADR with jurisdiction, residency, retention or deletion duties |
| `jobs` | Background jobs, queues or scheduled work |
| `external-apis` | Outbound calls to third-party APIs or integrations |
| `webhooks` | Inbound webhooks from third parties |
| `uploads` | File uploads or object storage |
| `i18n` | More than one user-facing language declared in VISION |
| `oauth` | Sign-in through OAuth or OIDC providers |
| `deploys` | Deploys somewhere users reach (a hosted app, an API, a worker) |
| `public-web` | A public web surface served to browsers (CDN, static assets, headers) |
| `db` | A database with a schema and migrations |

Tags are lower-case, hyphenated, and only from this table; an unknown tag
is ignored by the filter. Adding a tag never hides anything; removing one
hides only items whose every tag is absent, so keep the list honest and
revisit it when an ADR changes what the project has.
