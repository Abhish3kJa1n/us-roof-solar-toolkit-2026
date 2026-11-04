# Preview deployment trigger

This file exists only to generate a harmless new commit on the isolated audit branch after Cloudflare Preview environment settings were updated.

It does not change runtime code, calculator behaviour, secrets, data, or production settings. The new preview deployment is expected to pick up the current Preview-only environment bindings and secrets so the live API smoke test can verify them.
