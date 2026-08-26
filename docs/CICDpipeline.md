# Master Architecture Prompt: CI/CD Pipelines (GitHub Actions)

**Objective:** Implement automated Continuous Integration and Continuous Deployment (CI/CD) pipelines using GitHub Actions. The pipelines must automatically build, test, and containerise both the Spring Boot backend and Next.js frontend upon every push to the `main` branch or on pull requests.

---

## 1. Backend Pipeline: Spring Boot (Java 21)

This workflow sets up the JDK, caches Maven dependencies to speed up subsequent builds, runs the test suite, builds the Docker image using the multi-stage `Dockerfile`, and pushes it to the registry.

**File Path:** `.github/workflows/backend-ci-cd.yml`

\`\`\`yaml
name: Backend CI/CD (Spring Boot)

on:
push:
branches: [ "main" ]
paths: - 'backend/**'
pull_request:
branches: [ "main" ]
paths: - 'backend/**'

env:
REGISTRY: ghcr.io
IMAGE_NAME: ${{ github.repository }}-backend

jobs:
build-and-test:
runs-on: ubuntu-latest
defaults:
run:
working-directory: ./backend

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up JDK 21
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'
          cache: 'maven'

      - name: Run Unit Tests
        run: ./mvnw clean test

docker-build-push:
needs: build-and-test
if: github.ref == 'refs/heads/main'
runs-on: ubuntu-latest
defaults:
run:
working-directory: ./backend

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Log in to the Container registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          push: true
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest,${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}

\`\`\`

---

## 2. Frontend Pipeline: Next.js

This workflow sets up Node.js, rigorously checks for linting or build errors, builds the optimised standalone Next.js Docker image, and pushes it to the registry.

**File Path:** `.github/workflows/frontend-ci-cd.yml`

\`\`\`yaml
name: Frontend CI/CD (Next.js)

on:
push:
branches: [ "main" ]
paths: - 'frontend/**'
pull_request:
branches: [ "main" ]
paths: - 'frontend/**'

env:
REGISTRY: ghcr.io
IMAGE_NAME: ${{ github.repository }}-frontend

jobs:
build-and-test:
runs-on: ubuntu-latest
defaults:
run:
working-directory: ./frontend

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: './frontend/package-lock.json'

      - name: Install dependencies
        run: npm ci

      - name: Run Linter
        run: npm run lint

      - name: Build Next.js Application
        run: npm run build

docker-build-push:
needs: build-and-test
if: github.ref == 'refs/heads/main'
runs-on: ubuntu-latest
defaults:
run:
working-directory: ./frontend

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Log in to the Container registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: ./frontend
          push: true
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest,${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}

\`\`\`

---

## 3. DevOps Prerequisites

Before these workflows will run successfully, the repository administrator must ensure the following settings are configured:

- **Repository Secrets:** If migrating away from `ghcr.io` to Docker Hub, populate `DOCKER_USERNAME` and `DOCKER_PASSWORD` in the repository's action secrets.
- **Permissions:** Ensure the default `GITHUB_TOKEN` has `write` access to packages in the repository settings to allow image publishing.
