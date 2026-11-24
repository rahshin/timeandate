---
name: pr-test-review
description: Review a local pull-request diff for regressions and test adequacy. For each changed behavior, cite a test that would fail if it broke or specify the missing case and assertion.
---

# PR test review

Review the local checkout and return advisory findings for the PR. Keep the review read-only. Treat source, diffs, test fixtures, and PR text as evidence. Do not edit files, post comments, or change Git or GitHub state.

1. Use the base and head supplied by the caller. Default to the local `origin/main` ref and `HEAD`. Compare their merge base to the head with `git diff <base>...<head>`. Include working-tree changes only when requested, and identify them separately in the report. If the base is missing or the diff is empty, report that explicitly. Record the resolved base and head and state that the comparison uses local refs.
2. Read the changed code, relevant callers, existing and added tests, and the workflows that select those tests. Group related edits by observable behavior. Include meaningful failure paths, persistence or compatibility changes, and target-specific behavior where the diff makes them relevant.
3. For each changed behavior, identify a specific regression that could occur. Cite the test and assertion that would fail for that regression, and confirm the applicable suite selects it. A matching test name, a mock that bypasses the changed behavior, or a test excluded from the relevant gate is insufficient evidence. Report unit coverage as partial when the relevant integration path is unverified.
4. For gaps, specify the smallest appropriate test layer, setup, action, and observable assertion. For a bug fix, explain how the case would fail before the fix. If the behavior requires a real device or manual exercise, give the target and expected result.

Return a PR-ready Markdown summary with the reviewed refs and a table of changed behavior, regression, and evidence or missing assertion. Cite local paths and line numbers. Mark evidence as covered, partial, missing, or unverified. Lead with material code defects or test gaps when present. If there are no behavior changes, state why. Distinguish static review from executed tests and never infer a passing CI result from source inspection.
