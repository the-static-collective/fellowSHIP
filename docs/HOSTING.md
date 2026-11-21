# Hosting fellowSHIP on GitHub Pages

**Status (2026-11-21):** GitHub Pages deployed successfully. Cloudflare live DNS is configured. GitHub's deployment logs identify the public URL as `http://fellowship.abundent.org/`; an external HTTPS handshake/certificate has **not** been independently verified. Do not call the site fully ready for Paula's login test until HTTPS succeeds in a real browser.

## Current topology

```text
fellowship.abundent.org
      |
  Cloudflare DNS (DNS-only CNAME)
      |
  the-static-collective.github.io
      |
  GitHub Pages: the-static-collective/fellowSHIP, branch gh-pages, root
      |
  index.html + styles.css + app.js
      |
  Neon Auth + Neon Data API (existing isolated fellowSHIP database)
```

The repository `gh-pages` branch contains **only** the static website plus `CNAME` and `.nojekyll`. Private backend secrets, test scripts, and SQL documentation are not in that published branch. The frontend itself embeds the public Neon Auth/Data API base URLs; those are not privileged credentials.

Published branch commit at initial deployment: `8b8dc3385ff08557f2fe229f3df104568feba17d`. GitHub's [Pages deployment run](https://github.com/the-static-collective/fellowSHIP/actions/runs/44922316209) succeeded. The custom domain was recognized automatically from the `CNAME` file. Neon Auth trusted domains include `https://fellowship.abundent.org`.

DNS record:
- Zone: `abundent.org` (Cloudflare authoritative DNS, accessible through connected Porkbun → Cloudflare records)
- Type: CNAME
- Host: `fellowship`
- Value: `the-static-collective.github.io`
- Proxy: OFF (DNS-only), matching other static Abundent GitHub Pages sites
- No changes to apex, MX/SPF, HUMKIN or other subdomains

## Update the site safely

The development source of truth remains `feat/commons-foundation-001` until PR #1 merges; only published website files are copied to `gh-pages`. Do not accidentally publish `db/`, `docs/`, workflow files, secrets, or confidential files on the public branch.

1. Review and test changes in the source feature branch.
2. Update the `gh-pages` branch's `index.html`, `styles.css`, and `app.js` with the reviewed versions, leaving `CNAME` and `.nojekyll` intact. A normal git push by an authorized user triggers GitHub's Pages deployment.
3. Confirm the GitHub Pages build/deployment job succeeds, then check the custom-domain website in a private browser tab.
4. Verify authentication, invitation-link redemption, task writes, and cross-room denial scenarios from [TEST_PLAN.md](TEST_PLAN.md).
5. If a new version breaks the site, restore the last known-good static files on `gh-pages` via a **new** commit. Do not use force push or change the source of other projects.

To configure the Pages source manually, open [repo Pages settings](https://github.com/the-static-collective/fellowSHIP/settings/pages) and inspect `Deploy from a branch → gh-pages → / (root)`. It was active as of the initial deployment. If the GitHub certificate is not ready, enable **Enforce HTTPS** when that option becomes available and retest.

## Vercel retirement

An old **protected**, temporary fellowSHIP-only Vercel project still exists: `fellowship-commons-preview` (`prj_TOVaxW01SKW6ukkmADlT8XOL4FNq`). It is not tied to `fellowship.abundent.org`. Keep it temporarily as a fallback **only until HTTPS and live two-person tests succeed** on GitHub Pages; then pause the project and later delete it through the Vercel account if desired. Never remove or repoint unrelated Vercel projects.

## Outstanding launch checks

- Verify `https://fellowship.abundent.org` has a valid TLS certificate on a real device/browser. DNS-only CNAME is configured; propagation/certificate provisioning can take time.
- Test first account creation, email OTP verification, correct origin handling, and reload persistence in a real browser.
- Complete actual two-account and unrelated-third-account privacy tests. Source/CI checks alone do not certify RLS in live user sessions.
- Before inviting an entire church, plan spam/rate controls, backups, member governance and a privacy notice.
