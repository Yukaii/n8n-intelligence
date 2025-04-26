# Product Requirements Document (PRD)

## Project: n8n Workflow AI Generator

---

### 1. **Overview**

This project aims to provide an AI-powered interface to generate and manage n8n workflows. Users can connect to their own n8n instances, and the system will leverage retrieval-augmented generation (RAG) to create accurate, context-aware workflows. The application will feature a modern frontend (React, shadcn, Vite) and a performant backend (Hono, Bun).

---

### 2. **Goals**

-  Allow users to generate n8n workflows via AI using natural language prompts.
-  Support custom n8n endpoints and authentication for user-specific workflow generation.
-  Use RAG to improve AI understanding of available node types and parameters.
-  Provide a seamless, modern UI/UX.
-  Ensure fast development and deployment with Bun and Vite.

---

### 3. **Features & Requirements**

#### 3.1. **User Authentication & n8n Endpoint Setup**
-  Users can enter and save their custom n8n API endpoint and authentication token/credentials.
-  The app will validate the endpoint and credentials before enabling workflow generation.
-  Users can switch between multiple saved n8n instances.

#### 3.2. **AI Workflow Generation**
-  Users input a natural language prompt describing their desired automation.
-  The AI uses RAG to:
  - Query the user's n8n instance for available nodes (via API, if authenticated).
  - Supplement with a default node list if the user has not connected their own instance.
-  The AI generates an n8n workflow JSON, including nodes, connections, and parameters.
-  The generated workflow is displayed in a user-friendly editor and can be exported or sent directly to the user’s n8n instance.

#### 3.3. **Node Information Retrieval**
-  The system can query the n8n instance’s `/rest/nodes` endpoint (or similar) using scripts like `scripts/crawl-nodes.ts` to retrieve up-to-date node definitions and parameters.
-  If the user is not authenticated, the system uses a bundled default node list for prompt context.

#### 3.4. **Frontend**
-  Built with React, shadcn/ui, and Vite for fast, modern development.
-  Key screens:
  - **Authentication/Setup**: Enter and manage n8n endpoints/credentials.
  - **Prompt Input**: Enter workflow requests, view results.
  - **Workflow Editor**: View and edit generated workflows in a structured or visual format.
  - **Node Browser/Reference**: Browse available nodes and their descriptions.

#### 3.5. **Backend**
-  Built using Cloudflare Workers (likely with Hono framework) and Bun (runtime/scripting).
-  Responsibilities:
  - Handle authentication and proxy requests to n8n instances.
  - Manage user sessions and endpoint configs.
  - Serve node metadata for RAG and prompt generation.
  - Interface with the AI model (OpenAI, Anthropic, etc.) for workflow generation.
  - Optionally, handle workflow deployment to user’s n8n instance.

#### 3.6. **RAG (Retrieval-Augmented Generation)**
-  The backend or AI prompt layer will:
  - Use vector embeddings of node definitions (created via scripts like `scripts/embed-and-vectorize.ts`) for semantic search.
  - Retrieve relevant node definitions and parameter info based on user prompt similarity (using scripts like `scripts/query-vectorize.ts`).
  - Provide this context to the AI for more accurate and context-aware workflow generation.

#### 3.7. **Default Node List**
-  The app ships with a default node list located at `worker/data/defaultNodes.json` (from a recent official n8n release) for use when no endpoint is configured.
-  This list is also used to supplement node information for the AI prompt and potentially for the RAG vector store.

---

### 4. **Non-Functional Requirements**

-  **Performance:** Fast prompt-to-workflow generation (<3 seconds typical).
-  **Security:** Store authentication tokens securely; never expose user credentials.
-  **Scalability:** Support multiple users and endpoints.
-  **Extensibility:** Easily add support for new node types or AI models.
-  **Developer Experience:** Hot-reload and fast builds with Bun and Vite.

---

### 5. **User Stories**

| ID | As a...      | I want to...                                         | So that...                                 |
|----|--------------|------------------------------------------------------|--------------------------------------------|
| 1  | User         | Connect my own n8n instance with authentication      | I can generate workflows using my nodes    |
| 2  | User         | Enter a prompt describing an automation              | The AI generates a usable n8n workflow     |
| 3  | User         | See which nodes are available and their parameters   | I can understand and modify workflows      |
| 4  | User         | Edit and export or deploy the generated workflow     | I can use it in my n8n instance            |
| 5  | Admin/Dev    | Update the default node list easily                  | The AI stays up-to-date with n8n releases  |

---

### 6. **Technical Stack**

| Layer      | Technology        | Notes                             |
|:-----------|:------------------|:----------------------------------|
| Frontend   | React, shadcn/ui, Vite | Modern UI, fast dev, composable |
| Backend    | Cloudflare Workers, Hono, Bun | Scalable serverless, Bun for scripting/local dev |
| AI         | OpenAI/Anthropic/etc | RAG prompt engineering           |
| n8n API    | User-provided or default | Node info, workflow management |

---

### 7. **Wireframes / UI Sketches**

*(To be provided separately, but should include: authentication page, prompt input, workflow viewer/editor, node browser.)*

---

### 8. **Milestones**

| Milestone                       | Description                                   |
|---------------------------------|-----------------------------------------------|
| Project Setup                    | Repo, CI, base frontend/backend scaffolding   |
| n8n Endpoint/Auth Integration    | User can set up and validate endpoints        |
| Node Info Fetching & RAG         | Backend fetches and serves node metadata      |
| AI Prompt & Workflow Generation  | End-to-end prompt to workflow JSON            |
| Frontend Editor & Export         | Edit/view/export generated workflows          |
| Polish & Docs                    | Final QA, docs, and deployment                |

---

### 9. **Risks & Mitigations**

-  **n8n API Version Drift:**
  *Mitigation*: Regularly update default node list, allow users to refresh node info from their instance.

-  **Security of User Credentials:**
  *Mitigation*: Use secure storage, never log or expose sensitive data.

-  **AI Output Quality:**
  *Mitigation*: Use RAG, prompt engineering, and user feedback loop.

---

### 10. **Success Metrics**

-  Time to generate a workflow from prompt
-  % of workflows generated that run successfully on user’s n8n
-  User satisfaction (feedback, NPS)
-  Number of active connections to custom n8n instances

---

## Appendix

-  **References:**
  - [n8n API Docs](https://docs.n8n.io/api/)
  - [n8n Nodes List](https://n8n.io/integrations/)
  - [shadcn/ui](https://ui.shadcn.com/)
  - [Hono](https://hono.dev/)
  - [Bun](https://bun.sh/)
