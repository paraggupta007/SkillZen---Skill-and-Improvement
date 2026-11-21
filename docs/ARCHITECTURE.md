# Architecture

Currently implemented: frontend scaffold, HTTP foundation, DI composition root, event bus and database schema/client. The interview sequence and domain components below are targets, not implemented features.

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

Only the application foundation and DB client exist today; repositories, services and providers are planned.

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
