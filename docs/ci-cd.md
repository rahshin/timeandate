# CI/CD and releases

## New feature

```mermaid
flowchart LR
  A["Push feature branch"] --> B["PR to main"]
  B --> C["Required CI<br />Workflow lint, tests, build"]
  C --> D["Merge and verify push CI"]
  D --> E["Candidate v1.3.0-rc.1<br />Build once and checksum"]
  E --> F["Deploy to QA and smoke-test"]
  F --> G["Publish prerelease"]
  G --> H["Promote<br />GitHub production approval"]
  H --> I["Deploy identical bundle and smoke-test"]
  I --> J["Publish v1.3.0"]
```

## Bug fix

```mermaid
flowchart LR
  A["Start from shipped v1.3.0"] --> B["Create release/1.3 and patch branch"]
  B --> C["Patch PR with regression test"]
  C --> D["Merge into release/1.3<br />Verify push CI"]
  D --> E["Candidate v1.3.1-rc.1<br />QA and prerelease"]
  E --> F["Approve production"]
  F --> G["Deploy, verify, publish v1.3.1"]
  D --> H["Backport fix by PR to main"]
```

## Run a release

1. Merge a feature into `main` or a patch into the corresponding `release/<major>.<minor>` maintenance branch. Wait for the CI **push** run for that commit to succeed.
2. From **Actions → Release → Run workflow**, select workflow ref `main` and operation `candidate`. Leave `source_sha` blank to build the commit at `main` when you start the run. Leave `tag` blank to use the selected commit’s `package.json` version and the next RC number, for example `v0.1.0-rc.1`. Enter a full source SHA for a maintenance branch or an explicit RC tag to override the defaults. Once a version ships, bump `package.json` before cutting the next automatic candidate.
3. The run checks the commit and CI, builds the bundle, stamps its source SHA and candidate tag, and computes a SHA-256 checksum. QA deploys that bundle and checks live identity and that both app routes load. A successful QA run publishes the bundle and checksum as prerelease assets. Test the user-facing behavior on QA before promoting.
4. Dispatch `promote` with the candidate tag. Review the plan summary and digest and select **Review deployments → Approve and deploy**. The production job deploys the verified candidate bundle, validates live identity, and publishes the stable tag and release with identical assets. The deployed manifest retains the original candidate tag to identify the payload. The stable release notes link it to the release version.
5. If production needs recovery, dispatch `rollback` with an earlier stable tag. Review and approve it through the same production environment. Rollback uses the saved bundle and verifies the live result.

## Troubleshooting

- **CI or QA failed.** Fix the cause and run again with the same candidate tag if it is still unused. Move to the next RC number after publication.
- **Production deploy or verification failed.** Inspect the job and current `/build-info.json` on production. If the stable tag has not been created, rerun promotion or restore the prior stable version.
- **Release waiting for approval.** Open the **Release** run and review its plan output. The production secrets become available to the deployment job after review.
- **Concurrent releases.** Release runs share one concurrency group. Avoid dispatching multiple pending releases, since a newer pending run can replace an older one.
- **Mobile artifacts.** **Build mobile apps** is a separate manual workflow. A successful web release does not imply a signed native release.

A SHA-256 checksum detects changed or corrupted bytes. Control over publishing releases and writing release tags establishes who can supply those bytes.
