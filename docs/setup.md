# GitHub and Cloudflare setup

## GitHub

1. Push the project to the public `rahshin/timeandate` repository.
2. Configure branch rules for `main` and `release/**` to require PRs and the CI `validate` check. Limit force pushes and deletions. Restrict release tag and release asset writes to trusted maintainers and the release process.
3. Create environments named `qa` and `production`. Allow deployments from `main` in both. Under **production**, add a required reviewer. Leave **Prevent self-review** off for a solo demo or use a second reviewer and enable it.
4. Set the environment secret `CLOUDFLARE_API_TOKEN` and environment variables `CLOUDFLARE_ACCOUNT_ID` and `DEPLOY_URL` for each. Add the optional repository variable `QA_URL` for the promotion plan summary.

PR CI uses a read-only contents token and has no deployment environment. Publishing jobs receive write access to repository contents. Deployment jobs use their Cloudflare environment token and read-only GitHub access.

For native signing environments, see [mobile builds](mobile.md).

## Cloudflare

Use the Cloudflare account that owns the Workers and use its Workers subdomain or dedicated hostnames. Wrangler config names the Workers `timeandate-qa` and `timeandate`. Give each environment a separate Cloudflare API token scoped to the account and suitable for deploying Workers. If a hostname needs DNS or domain configuration, configure it in Cloudflare and set the matching `DEPLOY_URL`.

Keep GitHub Actions as the deployment entry point so production passes through GitHub environment approval. Do not connect an automatic Cloudflare deploy on pushes to main.

Validate setup by cutting a candidate, visiting the QA URL, reviewing the workflow plan, and promoting through GitHub. Check the production release and its live `/build-info.json`.

- [GitHub deployment environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
- [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/get-started/)
