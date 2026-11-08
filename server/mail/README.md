# Zoho contract review integration

The GitHub Pages frontend uses the authenticated Supabase session only. Zoho credentials, OAuth refresh tokens, and encryption keys must never be placed in browser code or public repository files.

Backend: Cloudflare Worker with D1. Set `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET` and a random 32-byte Base64 `TOKEN_KEY` through Cloudflare secrets. Set `MAILBOX_EMAIL`, `REVIEWER_EMAIL`, `ZOHO_REGION`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `APP_ORIGIN`, `APP_RETURN` and `CALLBACK_URL` as runtime configuration. Reviewer email must match a confirmed Supabase user; `ALLOWED_USER_IDS` can be used instead.

Apply schema.sql and bind the database as DB. The OAuth grant requests only ZohoMail.messages.READ, ZohoMail.accounts.READ and ZohoMail.folders.READ. It discovers the configured mailbox and Inbox, validates message access, and encrypts refresh tokens with AES-GCM. Interrupted discovery retains an encrypted pending grant that the authenticated reviewer can resume through /connect. OAuth state is single-use, expires after ten minutes, and is bound to an HttpOnly Secure cookie.

The frontend entry is #team~mail, also linked from the OCR panel. Drafts are separate from production contracts. All fields begin unapproved. A renewal requires selecting its existing contract. Attachments are downloaded through an authenticated ownership check; PDF/Word/OCR extraction runs in the browser. Approval saves only checked fields and attaches original files. Failed attachment uploads keep the review item available for retry.

Limitations: Inbox filtering uses Arabic/English contract and renewal keywords in subject/summary. Messages without these keywords may be missed. Each scan covers up to 1,000 messages and reports incomplete coverage above that limit. The list displays up to 200 pending drafts. Attachments are limited to 20 MiB; OCR reads up to 14 pages. Extraction is heuristic and requires human review. No messages are sent, deleted, moved, or marked read.

Configure a ten-minute cron after live verification. Do not log OAuth callback URLs or tokens. Operational errors should expose only fixed error codes, never provider response bodies or credentials. Cloudflare fetch supports manual redirects; reject non-success responses rather than forwarding Authorization to redirect targets.

Validation: `node --test server/mail/mail.test.mjs` (Node 24+). Mocked tests verify encryption, reviewer authorization, OAuth state/cookies, mailbox discovery, resumable grants, deduplication, attachment ownership, and manual approval gating. These tests do not replace live Zoho and application checks.
