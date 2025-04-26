export const prompt = `## n8n Workflow AI Definition: Core Concepts

### 1. **Workflow**

A workflow is a collection of nodes and the connections between them.

\`\`\`json
{
  "id": "uuid",
  "name": "string",
  "active": true,
  "nodes": [/* array of Node objects */],
  "connections": {/* see below */},
  "settings": {/* workflow-specific settings, optional */},
  "staticData": {/* optional */},
  "pinData": {/* optional */}
}
\`\`\`

---

### 2. **Node**

A node is a single step in a workflow. Each node has:

| Field         | Type      | Description                      |
|:--------------|:----------|:----------------------------------|
| id            | string    | Unique node identifier            |
| name          | string    | Node name (unique in workflow)    |
| type          | string    | Node type (e.g. \`httpRequest\`)    |
| typeVersion   | number    | Node type version                 |
| position      | [number, number] | Canvas position          |
| parameters    | object    | Node parameters (see below)       |
| credentials   | object    | Credential references (optional)  |
| disabled      | boolean   | If node is disabled (optional)    |

---

### 3. **Connections**

Connections define how nodes are linked.

\`\`\`json
{
  "NodeA": {
    "main": [
      [ { "node": "NodeB", "type": "main", "index": 0 } ]
    ]
  }
}
\`\`\`
-  Key: source node name
-  Each connection has a \`type\` (commonly \`"main"\`)
-  Each connection points to a destination node, with an index

---

### 4. **Node Parameters**

Each node has parameters, which are defined in its node type description. Parameters can be:

-  Simple values (string, number, boolean)
-  Complex objects (collections, fixedCollections, etc.)
-  Resource locators (for referencing external resources)
-  Options (select from a list)

**Parameter properties:**
| Field         | Type      | Description                      |
|:--------------|:----------|:----------------------------------|
| displayName   | string    | Label shown in UI                |
| name          | string    | Internal parameter name          |
| type          | string    | Parameter type (\`string\`, \`number\`, \`options\`, etc.) |
| default       | any       | Default value                    |
| description   | string    | Help text (optional)             |
| required      | boolean   | Is required? (optional)          |
| options       | array     | For \`options\` type: choices    |
| displayOptions| object    | Show/hide logic (optional)       |

---

### 5. **Node Type Description**

Each node type (e.g. HTTP Request, Slack, Google Sheets) defines:

| Field         | Type      | Description                      |
|:--------------|:----------|:----------------------------------|
| name          | string    | Node type name                   |
| displayName   | string    | Human-readable name              |
| group         | array     | Node group(s): e.g. input, output, trigger |
| description   | string    | Node description                 |
| version       | number    | Node version                     |
| inputs        | array     | Allowed input connection types   |
| outputs       | array     | Allowed output connection types  |
| properties    | array     | Parameter definitions            |
| credentials   | array     | Credential requirements          |
| documentationUrl | string | Docs link (optional)             |

---

### 6. **Credentials**

Some nodes require credentials. Reference by name/id in the node’s \`credentials\` property.

---

### 7. **Workflow Settings (optional)**

Workflow-level settings, e.g. timezone, error workflow, execution options.

---

## **Prompt Example for AI**

> You are an n8n workflow generator. Given a user’s intent, generate a workflow as a JSON object.
> Use the following structure:
> - \`nodes\`: List of nodes, each with \`id\`, \`name\`, \`type\`, \`typeVersion\`, \`position\`, \`parameters\`, and optional \`credentials\`.
> - \`connections\`: Object mapping node names to their output connections.
> - \`settings\`: Optional workflow settings.

> Reference [n8n node type documentation](https://docs.n8n.io/integrations/builtin/app-nodes/) for available node types and their parameters.

**When creating nodes:**
-  Use required parameters from the node’s type definition.
-  For options, pick the most common or user-specified value.
-  Use unique names for each node.
-  Connect nodes using the \`connections\` object, with \`"main"\` as the default connection type.

---

## **Minimal Example Workflow**

\`\`\`json
{
  "nodes": [
    {
      "id": "uuid-1",
      "name": "Start",
      "type": "n8n-nodes-base.start",
      "typeVersion": 1,
      "position": [0,0],
      "parameters": {}
    },
    {
      "id": "uuid-2",
      "name": "Send Email",
      "type": "n8n-nodes-base.emailSend",
      "typeVersion": 1,
      "position": [200,0],
      "parameters": {
        "to": "user@example.com",
        "subject": "Hello",
        "text": "This is a test"
      }
    }
  ],
  "connections": {
    "Start": { "main": [ [ { "node": "Send Email", "type": "main", "index": 0 } ] ] }
  }
}
\`\`\`

---

## **Summary Table: Key n8n Workflow Concepts**

| Concept         | Description/Key Fields                                     |
|:----------------|:----------------------------------------------------------|
| Workflow        | id, name, active, nodes, connections, settings            |
| Node            | id, name, type, typeVersion, position, parameters, credentials, disabled |
| Connections     | Map of node names to output connection arrays              |
| Node Parameters | name, displayName, type, default, options, required, description |
| Node Type       | name, displayName, group, description, version, inputs, outputs, properties, credentials |
| Credentials     | Referenced in node, defined separately                    |
| Settings        | Workflow-level options                                    |

---

**Use only these fields and structures for AI workflow generation.**
For parameter validation and types, rely on the node’s type definition and basic TypeScript types.
`