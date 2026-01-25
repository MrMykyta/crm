# Report14012026_Client_ApiUsage

## Scope
- Searched `client/src` for direct HTTP calls (fetch/axios/etc.) outside `client/src/store`.
- Looked for any backend usage not routed through store (e.g., socket.io).
- Focused on CRM domains: departments, contact-points, contacts, deals.

## Direct HTTP Calls Outside Store
| File:Line | Endpoint | companyId usage | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| `client/src/hooks/useBrandAndBackground.js:63` | `GET {API_URL}/api/companies/:companyId` | companyId in path (from `window.__COMPANY_ID__` or hook param) | MED: breaks if `/companies/:id` is removed or guard added | Move to store (use `companyApi` or add RTK endpoint for avatar) |
| `client/src/hooks/useBrandAndBackground.js:107` | `GET {API_URL}/api/users/me` | none | LOW | Move to store (use `userApi.getMe`) |
| `client/src/pages/auth/ResetPasswordPage/index.js:9` | `POST /api/auth/reset` | none (body has token + password) | LOW | Move to store (add auth/session RTK endpoint) |
| `client/src/components/auth/ForgotPasswordModal/index.js:7` | `POST /api/auth/password/reset-request` | none (body has email) | LOW | Move to store (add auth/session RTK endpoint) |
| `client/src/hooks/useListResource.js:3,17` | endpoint unknown (import `../api/resources` is missing) | unknown | MED: hidden API layer + broken import if used | Remove or replace with RTK query if revived |

## Non-HTTP Backend Calls Outside Store
| File:Line | Transport | companyId usage | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| `client/src/sockets/io.js:29-35` | socket.io to `{API_URL}` with token | none | LOW (not affected by companyId guard) | Keep as realtime channel; document as non-store backend usage |

## CRM Domain Coverage
- No direct HTTP calls outside store found for `departments`, `contact-points`, `contacts`, `deals`.
- No API utilities outside store directly referencing these domains.
