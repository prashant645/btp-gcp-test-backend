# btp-gcp-test-backend

Backend for the btp-demo app on SAP BTP Kyma. The frontend lives in
[btp-gcp-test-frontend](https://github.tools.sap/GTLCInfra/btp-gcp-test-frontend) and calls this service.

## API

Swagger UI is at `/docs`, and the OpenAPI spec at `/openapi.json`. `/` redirects to `/docs`.

| Request | Response |
|---|---|
| `GET /greeting?lang=<code>` | `{"message":"Hello World","lang":"en","version":"<commit>"}`; `lang` is `en` (default), `de`, `fr`, `es` or `it`; anything else is `400` |
| `GET /languages` | `[{"code":"en","name":"English"}, ...]` |
| `GET /openapi.json`, `GET /docs` | OpenAPI 3 spec, Swagger UI |
| `GET /version` | the deployed commit (`APP_VERSION`) |
| `GET /healthz` | `OK` |
| anything else | `404`; non-GET is `405`, and the APIRule allows GET only |

## Run locally

```bash
npm test
APP_VERSION=local PORT=3001 npm start &
curl "http://localhost:3001/greeting?lang=de"
open http://localhost:3001/docs

# e2e: needs the frontend running on 3000, pointing at this backend (see its README)
bash scripts/runTest.sh -e dev -v local -u http://localhost:3001 -f http://localhost:3000
```

## e2e and rollback

The post-deploy e2e checks this API, then the frontend that calls it: the frontend's `/api/greeting`
(at `consumer.frontendUrl` in `values-<env>.yaml`) must return this backend's version. So a backend
change that breaks the frontend fails here, and **this backend rolls itself back**.

If the frontend is down, `runTest.sh` exits 98 and the rollback is skipped, because the backend isn't at fault.
The rollback is also skipped when the run redeploys the commit that's already live.

## Branching and deployment

Same branching strategy and pipeline as the frontend repo. See its
`docs/branching-strategy.md` and `docs/demo-runbook.md`.

| Branch | Workflow | Environment | Namespace |
|---|---|---|---|
| `feature/**`, `bugfix/**`, `hotfix/**`, any PR | `ci.yaml` | none | — |
| `develop`, `testing/**` | `deploy-dev.yaml` | dev | `default` |
| `master`, `rel.YYYY.MM.DD[-hotfix.N]` | `deploy-qa.yaml` | qa | `demoapp-qa` |
| `vYYYY.MM.DD[-hotfix.N]` | `deploy-prod.yaml` | prod | `demoapp-prod`, after the QA check and reviewer approval |

Dev and QA: Build & Test, then Deploy (`helm upgrade --atomic`), then APIRule + smoke, then e2e (Newman,
`e2e/backend.postman_collection.json`). If anything after Deploy fails, the release is rolled
back to its previous revision (except in the two cases above) and the run stays red.

| | Value |
|---|---|
| Helm release / chart | `demoapp-backend` / [helm/demoapp-backend](helm/demoapp-backend) |
| Image | `gtlc-production.common.repositories.cloud.sap/btp-gcp-test-backend-<env>:<commit>` (prod gets a copy of the QA image) |
| Chart | `oci://gtlc-production.common.repositories.cloud.sap/btp-gcp-test-charts/demoapp-backend`, version `0.1.0-<commit>` |
| Used by | the frontend, via its `backend.baseUrl` (this service's public URL per environment) |

## Public URLs

| Env | URL |
|---|---|
| dev | `https://demoapp-backend-dev.a35836f.stage.kyma.ondemand.com` |
| qa | `https://demoapp-backend-qa.a35836f.stage.kyma.ondemand.com` |
| prod | `https://demoapp-backend.a35836f.stage.kyma.ondemand.com` |

## Repository setup

1. Create the repo in the browser: **github.tools.sap → GTLCInfra → New repository**, name
   `btp-gcp-test-backend`, private, with no README, `.gitignore` or license (this folder has them).
2. Push this folder as `develop` and `master` (see below). Then go to **Settings → General → Default branch** and set it to `develop`.
3. **Settings → Secrets and variables → Actions:** add the same three secrets as the frontend repo:
   `GCP_KUBECONFIG_B64`, `REGISTRY_USERNAME`, `REGISTRY_PASSWORD`.
4. **Settings → Environments:** create `production` with the required reviewers.
5. Branch protection: the same rules as the frontend repo.

```bash
cd btp-gcp-test-backend
git init -b develop
git add -A
git commit -m "Initial backend service"
git remote add origin https://github.tools.sap/GTLCInfra/btp-gcp-test-backend.git
git push -u origin develop
git push origin develop:master
```

The first push to `develop` deploys to dev.
