# Documentation site and published-package examples

Status: accepted for the owner-requested bilingual documentation site.

The public site uses VitePress and Workers Static Assets at
`https://soeditor.sohophp.app`, with GitHub Actions building, qualifying and
publishing immutable static artifacts. The site is a private workspace package
under `docs/site`; its Vue and deployment dependencies do not enter editor exports.

Public pages have complete Simplified Chinese and English counterparts. Internal
product authority, historical prompts and qualification evidence stay outside the
published site. Documentation is written under `docs/`; the root README is preserved.

Examples use exact npm versions via an alias, rather than monorepo source aliases.
They run in user-activated iframes with separate demand boundaries for Source and
formatting. Upload and persistence are explicit local simulations. Documentation
snippets reference executable source, and downloadable examples include their host.

A production build must match an already published editor version. A defect in the
1.2.0 CMS ESM artifact was discovered while implementing this site. The owner chose
to fix and release 1.2.1 before deployment instead of shipping a temporary optional
entry workaround. The new actual-artifact regression becomes an editor release gate.

Static files use real 404 responses, explicit preview noindex headers, fixed canonical
URLs and bilingual sitemap entries. Production is deployed only after the matching
master CI and site checks pass. Restore archives retain the last ten successful
versions and every version younger than 90 days.
