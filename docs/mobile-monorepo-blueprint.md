# Mobile Monorepo Blueprint (Production-Ready Starter)

This blueprint keeps **Ai-Playground** as a single npm-workspaces monorepo and introduces a narrow, production-minded mobile surface.

## Architecture Goals

- Keep the existing repo model (no package-manager migration).
- Add `apps/mobile` as a first-class Expo app.
- Add `packages/mobile-sdk` for strictly mobile-safe contracts/client logic.
- Keep mobile API scope narrow via `/mobile/*` endpoints in `apps/api`.
- Avoid leaking desktop-only management surfaces into the mobile MVP.

## Exact File Tree

```text
Ai-Playground/
  .devcontainer/
    devcontainer.json
  .github/
    workflows/
      ci.yml

  apps/
    web/
      app/
      components/
      lib/
      package.json
      tsconfig.json

    api/
      src/
        index.ts
        app.ts
        plugins/
          cors.ts
          auth.ts
          rate-limit.ts
        routes/
          auth/
            session.ts
            github.ts
          projects/
            members.ts
            provider-keys.ts
            inbox.ts
            phone-link.ts
          runs/
            create-run.ts
            list-runs.ts
            stream-run.ts
          tools/
            list-tools.ts
            permissions.ts
            invoke.ts
          mobile/
            session.ts
            projects.ts
            inbox.ts
            runs.ts
        services/
          auth/
            require-user.ts
            session-service.ts
            phone-token-service.ts
          projects/
            project-access-service.ts
            project-member-service.ts
          inbox/
            inbox-service.ts
          runs/
            run-service.ts
            stream-service.ts
          tools/
            tool-permission-service.ts
            tool-invocation-service.ts
          providers/
            provider-key-service.ts
          mobile/
            mobile-session-service.ts
            mobile-project-service.ts
        lib/
          db.ts
          crypto.ts
          env.ts
          logger.ts
        schemas/
          auth.ts
          inbox.ts
          mobile.ts
          runs.ts
          tools.ts
      package.json
      tsconfig.json

    worker/
      src/
        index.ts
        jobs/
          execute-run.ts
          ingest-document.ts
          eval-run.ts
        lib/
          db.ts
          env.ts
          logger.ts
      package.json
      tsconfig.json

    mobile/
      app/
        _layout.tsx
        (auth)/
          sign-in.tsx
          phone-link.tsx
        (tabs)/
          _layout.tsx
          projects.tsx
          inbox.tsx
          runs.tsx
          settings.tsx
        project/
          [projectId]/
            inbox.tsx
            runs.tsx
            run/
              [runId].tsx
      src/
        components/
          layout/
            Screen.tsx
            EmptyState.tsx
          inbox/
            InboxMessageCard.tsx
            InboxComposer.tsx
          runs/
            RunListItem.tsx
            RunStatusBadge.tsx
          session/
            AuthGate.tsx
        features/
          auth/
            hooks.ts
            store.ts
          inbox/
            hooks.ts
          projects/
            hooks.ts
          runs/
            hooks.ts
        lib/
          api/
            client.ts
            auth.ts
          config/
            env.ts
          storage/
            secure-store.ts
          query/
            query-client.ts
        types/
          navigation.ts
      assets/
        icon.png
        splash.png
      app.json
      eas.json
      babel.config.js
      metro.config.js
      package.json
      tsconfig.json

  packages/
    sdk/
      src/
      package.json

    ai-core/
      src/
        providers/
          openai.ts
          anthropic.ts
          google.ts
        routing/
          select-provider.ts
        runs/
          create-run.ts
          execute-model.ts
      package.json

    config/
      tsconfig.base.json
      eslint.base.cjs
      package.json

    mobile-sdk/
      src/
        index.ts
        client.ts
        contracts/
          auth.ts
          inbox.ts
          projects.ts
          runs.ts
      package.json
      tsconfig.json

  infra/
    db/
      migrate.mjs
      001_init.sql
      002_project_access.sql
      003_tooling.sql
      004_phone_links.sql
    docker/
      docker-compose.yml

  .env.example
  package.json
  tsconfig.base.json
```

## Starter `package.json` Files

### Root `package.json`

```json
{
  "name": "ai-playground",
  "private": true,
  "version": "0.2.0",
  "packageManager": "npm@10.9.0",
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "build": "npm run -ws --if-present build",
    "dev": "npm run -ws --if-present dev",
    "dev:web": "npm run dev -w @ai-playground/web",
    "dev:api": "npm run dev -w @ai-playground/api",
    "dev:worker": "npm run dev -w @ai-playground/worker",
    "dev:mobile": "npm run dev -w @ai-playground/mobile",
    "build:mobile": "npm run build -w @ai-playground/mobile",
    "typecheck": "npm run -ws --if-present typecheck",
    "typecheck:mobile": "npm run typecheck -w @ai-playground/mobile",
    "lint": "npm run -ws --if-present lint",
    "test": "npm run -ws --if-present test",
    "db:migrate": "node infra/db/migrate.mjs"
  },
  "engines": {
    "node": ">=22.0.0"
  }
}
```

### `apps/mobile/package.json`

```json
{
  "name": "@ai-playground/mobile",
  "private": true,
  "version": "0.1.0",
  "main": "expo-router/entry",
  "scripts": {
    "dev": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "build": "expo export --platform all",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@ai-playground/mobile-sdk": "0.1.0",
    "@tanstack/react-query": "^5.75.7",
    "expo": "~54.0.13",
    "expo-linking": "~7.1.7",
    "expo-notifications": "~0.32.12",
    "expo-router": "~5.1.0",
    "expo-secure-store": "~14.2.3",
    "expo-splash-screen": "~31.0.10",
    "expo-status-bar": "~3.0.8",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "react-native": "0.81.4",
    "react-native-safe-area-context": "5.4.0",
    "react-native-screens": "~4.11.1",
    "react-native-web": "~0.21.0",
    "zustand": "^5.0.4"
  },
  "devDependencies": {
    "@types/react": "~19.1.10",
    "typescript": "~5.9.2"
  }
}
```

### `packages/mobile-sdk/package.json`

```json
{
  "name": "@ai-playground/mobile-sdk",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./client": "./src/client.ts",
    "./contracts/auth": "./src/contracts/auth.ts",
    "./contracts/inbox": "./src/contracts/inbox.ts",
    "./contracts/projects": "./src/contracts/projects.ts",
    "./contracts/runs": "./src/contracts/runs.ts"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "zod": "^3.24.4"
  },
  "devDependencies": {
    "typescript": "^5.8.3"
  }
}
```

### `apps/api/package.json` (mobile-ready split)

```json
{
  "name": "@ai-playground/api",
  "private": true,
  "version": "0.2.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@ai-playground/ai-core": "0.1.0",
    "@ai-playground/mobile-sdk": "0.1.0",
    "@ai-playground/sdk": "0.1.0",
    "@fastify/cors": "^11.0.1",
    "bullmq": "^5.52.0",
    "fastify": "^5.3.3",
    "ioredis": "^5.6.1",
    "pg": "^8.15.6",
    "zod": "^3.24.4"
  },
  "devDependencies": {
    "@types/node": "^22.15.18",
    "@types/pg": "^8.15.2",
    "tsx": "^4.19.4",
    "typescript": "^5.8.3"
  }
}
```

## `apps/mobile/app.json` Starter

```json
{
  "expo": {
    "name": "AI Playground",
    "slug": "ai-playground",
    "scheme": "aiplayground",
    "version": "1.0.0",
    "orientation": "portrait",
    "userInterfaceStyle": "automatic",
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.aiplayground.mobile"
    },
    "android": {
      "package": "com.aiplayground.mobile"
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      "expo-notifications"
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

## Scope Guardrails for Mobile MVP

Include only:
- sign in + phone-link session bootstrap
- project pick/list
- inbox read/create
- run list and single run detail view

Keep desktop-only for now:
- provider key management
- tool permission management
- member management
- evals/trace deep detail
- full workspace config surfaces
