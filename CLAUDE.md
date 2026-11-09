# Tamkeen legal assistant

Canonical repository: AhmadAyash0077/tamkeen-legal. Production is GitHub Pages;
records and attachments are held in the existing authenticated Supabase workspace.

Use claude-mem for development continuity in this checkout. At session start search
the project's development memory; verify changeable facts against current source.
Save concise implementation decisions, test evidence and outstanding limitations.
Never copy production case files, identities, passwords, access tokens or contract
contents into development memory. Business memory uses separate namespaces and
must not be pulled into code-development prompts.

The primary application is index.html with browser globals. team-coordination.js
defines ten internal task roles, not autonomous Najiz/Nafith/Qiwa connections.
Do not label an external integration as connected without end-to-end evidence.

legal-memory-core.js defines pure memory rules; legal-memory.js stores memory
inside each source record under assistantMemory using existing writeDoc revision
checks and record access. Reviewed entries still are untrusted historical context.
Only user-selected reviewed entries may enter an AI prompt. Keep the existing
field/masking preview. Memory is never an independent legal authority.

server/memory/bridge.mjs is a loopback-only bridge to claude-mem. It checks a fresh
Supabase owner session and re-reads the source record under that session on every
sync. It never accepts arbitrary text, upstream URLs or project names from a browser.
The cloud record is authoritative. Local mirrors need explicit resynchronization.

Run node --test tests/*.test.cjs and node --test server/memory/*.test.mjs.
Use synthetic records for integration tests; do not create fake production cases.
