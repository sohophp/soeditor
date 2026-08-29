# Releasing SoEditor 0.5.x

Publication is an owner-authorized operation. Local quality gates and dry runs
do not grant permission to choose a license, publish packages, create a tag, or
use an npm identity.

## One-time owner prerequisites

1. Choose and commit exactly one approved `LICENSE`, `LICENSE.md`, or
   `LICENSE.txt`. Add the same approved npm `license` expression to the root
   manifest and all 16 public package manifests. Confirm it with
   `pnpm release:check-license`.
2. Create the npm organization named `soeditor` on the public-package plan,
   which creates the `@soeditor` scope, and confirm the publishing identity is
   an owner or member allowed to publish all 16 packages in it.
3. Create the protected GitHub `npm` environment and require reviewer approval.
4. Configure an environment-scoped `NPM_TOKEN` using a granular npm token with
   read/write package access and **Bypass 2FA** enabled. The bypass setting is
   required for this non-interactive initial publication and is disabled by
   default when a token is created. Restrict the token to the required package
   names/scopes where npm's token controls allow it. The initial release token
   must select **All Packages** so it can create every package in the release.
   If the token predates the organization, recreate it after joining the
   organization.
5. Enable GitHub private vulnerability reporting for the repository.

No package should be published until all five conditions are true. As a
separate repository-governance decision, protect `master` and require the CI
release gate when the maintainer is ready to require pull requests for release
changes.

Registry availability is not sufficient evidence that a new unscoped name can
be created. npm may reject an unpublished name under its package-name
similarity policy. Treat that response as a public naming decision: use an
owner-approved scoped name or complete an npm support appeal, then rerun every
release gate. Do not keep rotating credentials for a naming-policy rejection.

After the packages exist, configure npm trusted publishing for `publish.yml`
and the `npm` GitHub environment, verify one release through OIDC, then remove
the long-lived publishing secret. Until that migration is complete, an OIDC
exchange warning does not replace the granular token requirement.

## Patch policy

The 0.5.x line accepts correctness, security, accessibility, compatibility,
documentation, and measured performance fixes. New product capabilities belong
in a separately approved roadmap. Although 0.x permits breaking SemVer changes,
avoid them in patch releases; document an unavoidable break and use at least a
minor version.

All 16 public packages use an aligned version so consumers and support reports
can identify one tested release set. Add a Changeset for each user-visible
patch, update `CHANGELOG.md`, and let the release change deliberately advance
the package versions.

## Local release candidate verification

From a clean checkout using Node from `.nvmrc`:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm security:audit
pnpm release:dry-run
```

The dependency advisory command deliberately uses the canonical npm registry;
the configured installation mirror does not implement npm's audit endpoint.

Review the tarball list, package versions, public export maps, source maps,
bundle budgets, repository metadata, and absence of `workspace:` protocols.
Never publish from a dirty checkout or a commit different from the reviewed CI
commit.

## Publication

Run the `Publish npm packages` workflow from the verified commit. Enter its full
commit SHA, type `PUBLISH`, choose `latest` or `next`, and approve the protected
`npm` environment. The workflow repeats every release gate, performs a dry run,
verifies that none of the aligned package versions already exist, publishes
the `@soeditor/editor` umbrella first as a credential guard, publishes the
other packages with provenance, then installs from npm and loads the jsDelivr
global in Chromium.

Do not run `release:publish` casually from a developer workstation. It exists
as the workflow primitive and requires an already authorized npm identity.

After verification, the owner may create a signed `v<version>` tag and GitHub
release pointing to the exact published commit. Tags must not be used to hide a
failed or partially published release.

## Failed or partial publication

npm versions are immutable. Never overwrite, unpublish, or reuse a version to
repair a bad release. Determine which package versions became public, correct
the fault, advance the aligned patch version, rerun all gates, and publish the
new set. Deprecate a defective version with an actionable message only after
the replacement exists.

If CDN propagation alone is delayed, rerun the read-only registry verification;
do not republish identical artifacts.

## Registry verification

After publication, or to recheck propagation:

```bash
pnpm release:verify-registry 0.5.1
```

This creates a clean Vite consumer from the public npm registry and checks the
version-pinned jsDelivr JavaScript, CSS, source map, immutable global facade,
and basic editor lifecycle in Chromium.
