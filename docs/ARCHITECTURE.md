# Architecture

Currently implemented: frontend scaffold, HTTP foundation, auth and user repository, AI provider chain, round and evaluator strategies, DI composition root, event bus and database schema/client. The interview sequence and domain components below are targets, not implemented features.

## System

```mermaid
flowchart LR
  Browser[React + Vite] -->|REST and future SSE| API[Express API]
  API --> DB[(PostgreSQL / Neon pool)]
  API -. planned .-> AI[Free AI provider chain]
  Browser -. planned local analysis .-> Camera[Webcam metrics]
```

## Layers

```mermaid
flowchart TD
  Routes[Routes / controllers] --> Services[Services]
  Services --> Interfaces[Domain and repository interfaces]
  Interfaces --> Repositories[Repositories]
  Repositories --> DB[(Database)]
  Interfaces --> Providers[Provider adapters]
```

The auth service and user repository now implement this layering. Interview services and endpoints are planned; round and evaluation strategies are implemented but not wired to HTTP. AI adapters are implemented but have not been verified against live providers.

## Planned class diagram

```mermaid
classDiagram
  class ILLMProvider { <<interface>> }
  class LLMRouter
  class InterviewRound { <<abstract>> }
  class RoundFactory
  class IEvaluator { <<interface>> }
  class CompositeEvaluator
  LLMRouter --> ILLMProvider
  RoundFactory --> InterviewRound
  CompositeEvaluator --> IEvaluator
```

## Planned interview sequence

```mermaid
sequenceDiagram
  participant User
  participant Web
  participant API
  participant AI
  User->>Web: Start interview
  Web->>API: Create interview
  API->>AI: Generate question
  API-->>Web: Stream question
  User->>Web: Answer
  Web->>API: Submit answer
  API->>AI: Evaluate and prepare next question
  API-->>Web: Stream feedback
  Web->>API: Complete interview
  API-->>Web: Report status
```

The in-process event bus exists, but report generation and a durable job queue do not yet exist. Async work must account for process restarts before deployment.

## Authentication

Routes validate input and call `AuthService`, which depends on `IUserRepository`. `DrizzleUserRepository` is injected by the container; tests inject an in-memory implementation. Passwords use bcrypt, and one-hour JWTs are stored in httpOnly cookies. Logout clears the browser cookie but does not revoke copied tokens.

## AI routing

`LLMRouter` tries registered providers in configured order, twice each, with timeouts and independent circuit breakers. It records metadata through a repository interface. `JsonGenerator` validates outputs and requests one repair. Cached completions are opt-in and scoped; live streams are not cached. AI vendor keys are server-side only. No API route currently invokes the AI layer.
