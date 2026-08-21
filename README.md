# SapienWorx

## Continuous delivery

GitHub Actions validates pull requests to `main` and trusted pushes to `main`:

- `backend-ci-cd.yml` runs the Spring Boot Maven verification on Java 17, then publishes the backend container to GitHub Container Registry.
- `frontend-ci-cd.yml` runs the root Next.js type check and production build on Node 20, then publishes the standalone frontend container to GitHub Container Registry.

Pull requests never publish images. Before merging the workflows, enable **read/write package permissions** for the repository `GITHUB_TOKEN` in GitHub Actions settings. The publishing jobs generate lowercase `ghcr.io/<owner>/<repository>-backend` and `-frontend` image names automatically.

The frontend uses Next.js standalone output for its production image. The backend image contains the packaged Spring Boot JAR and runs as a non-root user. Configure application and SMTP secrets only in the deployment environment or GitHub Actions secrets—never in repository files.
