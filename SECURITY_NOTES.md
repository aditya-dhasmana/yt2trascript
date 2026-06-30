# Security update notes

Audit date: 2026-06-30

## Updates applied

- Next.js and `eslint-config-next`: 16.1.1 to 16.2.9
- React and React DOM: 19.2.3 to 19.2.7
- jsPDF: 4.0.0 to 4.2.1
- Axios: 1.13.5 to 1.18.1
- Google Gen AI SDK: 1.41.0 to 1.52.0 within the existing major version
- dotenv: 17.2.4 to 17.4.2
- `youtube-transcript`: 1.2.1 to 1.3.1
- Extension build tooling uses patched esbuild 0.28.1 and restricts caption fetches to HTTPS YouTube/Googlevideo hosts.
- Safe transitive updates from `npm audit fix`

Unused backend packages `bottleneck` and `p-queue` were removed.

## Current audit result

- Backend: 0 known vulnerabilities.
- Extension: 0 known vulnerabilities.
- Frontend: 2 moderate findings. Both are the same transitive PostCSS advisory carried inside Next.js 16.2.9.

`npm audit` currently proposes Next.js 9.3.3 as the automatic fix. That is a breaking downgrade from Next.js 16 and is not safe for this App Router project, so `npm audit fix --force` was intentionally not used.

The affected PostCSS path is used by the framework build pipeline; this application does not accept user-provided CSS. Continue monitoring Next.js releases and update when the framework ships a compatible patched dependency.

Recheck with:

```powershell
npm audit
Set-Location yt-transcript-server
npm audit
Set-Location ../extension
npm audit
```
