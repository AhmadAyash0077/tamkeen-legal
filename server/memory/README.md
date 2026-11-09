# Record memory and local claude-mem bridge

Record memory lives in `records.data.assistantMemory` on the same existing source
record. There is no new table, service key or broadened database policy. Existing
read/write ACLs apply. A note or saved conversation starts as a draft; an editor
reviews it, and the user explicitly selects reviewed entries to include in an AI
request. The existing send preview includes the exact selected context.

The loopback bridge runs with Node 20+ using `node server/memory/bridge.mjs`.
Windows: run `server/memory/start.ps1`; it starts claude-mem and the bridge hidden.
The worker is configured on port 37720 on this installation; the bridge uses 37721.
Never expose either port to the network or replace the loopback binding.

`POST /sync` accepts `{mod,id}` and the existing Supabase user bearer token.
It verifies the session, requires owner role, and fetches the current source record
using that token. It mirrors only reviewed, non-withdrawn memory, using a namespace
derived from user and record. It does not accept arbitrary upstream URLs, tokens,
text, observation IDs or project names in request bodies. Tokens are never stored.
Host and Origin checks, body limits, timeouts and per-record sync locks apply.

Sync is an explicit snapshot, not a background replication subscription. Re-sync
after changing or withdrawing a note to update/remove the local mirror. Revoking
cloud access does not remotely erase an owner's already-created local copy.
The app always uses the authoritative cloud record for AI context, never stale
local copies. Browser local-network permission may be required. The bridge and
claude-mem must run on the browser's computer; other devices keep cloud memory but
need their own local installation to mirror it. This is not a hosted memory API.

Memory storage does not require inference. Generating legal responses still needs
the app's AI connection; Claude Code account limits are separate. This release does
not connect government platforms or turn internal roles into autonomous agents.

Validation: `node --test tests/*.test.cjs server/memory/*.test.mjs`.
