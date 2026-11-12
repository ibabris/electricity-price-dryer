# Releases

| Version | Build | Date | State | What changed |
| --- | --- | --- | --- | --- |
| 1.0.1 | 10 | 2026-11-12 | In review | App talks to `electroprice.lv` directly (was the dead DigitalOcean host); prices refresh automatically while open and on foreground; API host resolved at runtime from `/api/config` so a backend move needs no new build; product name aligned to `ElektroPrice`; listing marketing URL corrected from `elektoprice.lv` to `elektroprice.lv` |
| 1.0.0 | 6 | 2026-09-23 | Live | Initial App Store release |
| 1.0.0 | 8 | 2026-11-12 | Rejected by Apple | Same code as build 7, refused with ITMS-90062: build number must exceed the approved 1.0.0 train |

Notes for the next release:

- Bump `expo.version` (marketing version) for anything user-visible — `autoIncrement` only moves the build
  number, and Apple closes a version train once a build is approved.
- Submission needs the **App Store Connect API key**, not the distribution certificate: key `VAR9R25BZZ`,
  issuer `69a6de73-948a-47e3-e053-5b8c7c11a4d1`, `.p8` at `~/.appstore/`. The old `8KGTRRS9N2` key belonged to
  a machine that no longer exists and its private key cannot be re-downloaded.
- `eas submit` exits 0 even when Apple rejects the binary later; the truth is the TestFlight build list and the
  `processingState`, so check those rather than trusting the CLI's success line.
