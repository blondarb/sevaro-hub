import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

const client = new DynamoDBClient({ region: 'us-east-2' });
const ddb = DynamoDBDocumentClient.from(client);
const TABLE = 'sevaro-improvement-queue';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'steve@sevaro.com')
  .split(',')
  .map((e) => e.trim().toLowerCase());

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || 'us-east-2_Owfb1zpgM';
const CLIENT_ID = process.env.COGNITO_CLIENT_ID || '7t8bjj2fjkvtu081qhledc627a';

const verifier = CognitoJwtVerifier.create({
  userPoolId: USER_POOL_ID,
  tokenUse: 'id',
  clientId: CLIENT_ID,
});

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
};

function response(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function parseBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    return null;
  }
}

async function verifyAdmin(event) {
  const auth = event.headers?.Authorization || event.headers?.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  try {
    const payload = await verifier.verify(token);
    const email = (payload.email || '').toLowerCase();
    if (!ADMIN_EMAILS.includes(email)) return null;
    return { email, sub: payload.sub };
  } catch {
    return null;
  }
}

const VALID_PRIORITIES = ['P1', 'P2', 'P3'];
const VALID_STATUSES = ['pending', 'in-progress', 'completed', 'deferred'];
const VALID_SCOPES = ['small', 'medium', 'large'];

export async function handler(event) {
  const method = event.httpMethod || event.requestContext?.http?.method;
  const path = event.path || event.rawPath || '';

  // CORS preflight
  if (method === 'OPTIONS') return response(200, {});

  // GET /improvements — admin only, list all improvements (optionally filtered)
  if (method === 'GET' && path.endsWith('/improvements')) {
    const admin = await verifyAdmin(event);
    if (!admin) return response(401, { error: 'Unauthorized — admin required' });

    const params = event.queryStringParameters || {};
    const { repoName, priority, status } = params;

    let items;

    if (repoName) {
      // Query by specific repo
      const queryParams = {
        TableName: TABLE,
        KeyConditionExpression: 'repoName = :repo',
        ExpressionAttributeValues: { ':repo': repoName },
      };
      const result = await ddb.send(new QueryCommand(queryParams));
      items = result.Items || [];
    } else {
      // Scan all
      const result = await ddb.send(new ScanCommand({ TableName: TABLE }));
      items = result.Items || [];
    }

    // Apply filters
    if (priority) {
      items = items.filter((i) => i.priority === priority);
    }
    if (status) {
      items = items.filter((i) => i.status === status);
    }

    // Sort: P1 first, then P2, then P3; within same priority, newest first
    const priorityOrder = { P1: 0, P2: 1, P3: 2 };
    items.sort((a, b) => {
      const pDiff = (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9);
      if (pDiff !== 0) return pDiff;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    return response(200, { improvements: items });
  }

  // GET /improvements/{repoName}/{promptId} — admin only, get single item
  if (method === 'GET' && path.match(/\/improvements\/[^/]+\/[^/]+$/)) {
    const admin = await verifyAdmin(event);
    if (!admin) return response(401, { error: 'Unauthorized — admin required' });

    const segments = path.split('/');
    const promptId = decodeURIComponent(segments.pop());
    const repoName = decodeURIComponent(segments.pop());

    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'repoName = :repo AND promptId = :id',
        ExpressionAttributeValues: { ':repo': repoName, ':id': promptId },
      })
    );

    if (!result.Items?.length) {
      return response(404, { error: 'Improvement not found' });
    }

    return response(200, { improvement: result.Items[0] });
  }

  // POST /improvements — admin creates entry
  if (method === 'POST' && path.endsWith('/improvements')) {
    const admin = await verifyAdmin(event);
    if (!admin) return response(401, { error: 'Unauthorized — admin required' });

    const body = parseBody(event);
    if (!body) return response(400, { error: 'Invalid JSON body' });

    const { repoName, promptId, title, priority, status, estimatedScope, planFile, promptFile, promptText } = body;

    if (!repoName || !promptId || !title || !priority) {
      return response(400, { error: 'repoName, promptId, title, and priority are required' });
    }

    if (!VALID_PRIORITIES.includes(priority)) {
      return response(400, { error: 'priority must be P1, P2, or P3' });
    }

    const itemStatus = status || 'pending';
    if (!VALID_STATUSES.includes(itemStatus)) {
      return response(400, { error: 'status must be pending, in-progress, completed, or deferred' });
    }

    if (estimatedScope && !VALID_SCOPES.includes(estimatedScope)) {
      return response(400, { error: 'estimatedScope must be small, medium, or large' });
    }

    const now = new Date().toISOString();
    const item = {
      repoName,
      promptId,
      title,
      priority,
      status: itemStatus,
      createdAt: now,
      updatedAt: now,
      createdBy: admin.email,
    };
    if (estimatedScope) item.estimatedScope = estimatedScope;
    if (planFile) item.planFile = planFile;
    if (promptFile) item.promptFile = promptFile;
    if (promptText) item.promptText = promptText;

    await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
    return response(201, { improvement: item });
  }

  // PATCH /improvements — admin updates status or fields
  if (method === 'PATCH' && path.endsWith('/improvements')) {
    const admin = await verifyAdmin(event);
    if (!admin) return response(401, { error: 'Unauthorized — admin required' });

    const body = parseBody(event);
    if (!body) return response(400, { error: 'Invalid JSON body' });

    const { repoName, promptId, ...updates } = body;

    if (!repoName || !promptId) {
      return response(400, { error: 'repoName and promptId are required' });
    }

    if (updates.priority && !VALID_PRIORITIES.includes(updates.priority)) {
      return response(400, { error: 'priority must be P1, P2, or P3' });
    }
    if (updates.status && !VALID_STATUSES.includes(updates.status)) {
      return response(400, { error: 'status must be pending, in-progress, completed, or deferred' });
    }
    if (updates.estimatedScope && !VALID_SCOPES.includes(updates.estimatedScope)) {
      return response(400, { error: 'estimatedScope must be small, medium, or large' });
    }

    // Build update expression dynamically
    const allowedFields = ['title', 'priority', 'status', 'estimatedScope', 'planFile', 'promptFile', 'promptText', 'whatsNewEntry', 'completedAt'];
    const expressionParts = ['#updatedAt = :updatedAt'];
    const exprNames = { '#updatedAt': 'updatedAt' };
    const exprValues = { ':updatedAt': new Date().toISOString() };

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        const placeholder = `#${field}`;
        const valuePlaceholder = `:${field}`;
        expressionParts.push(`${placeholder} = ${valuePlaceholder}`);
        exprNames[placeholder] = field;
        exprValues[valuePlaceholder] = updates[field];
      }
    }

    // Auto-set completedAt when status changes to completed
    if (updates.status === 'completed' && !updates.completedAt) {
      expressionParts.push('#completedAt = :completedAt');
      exprNames['#completedAt'] = 'completedAt';
      exprValues[':completedAt'] = new Date().toISOString();
    }

    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { repoName, promptId },
        UpdateExpression: `SET ${expressionParts.join(', ')}`,
        ExpressionAttributeNames: exprNames,
        ExpressionAttributeValues: exprValues,
      })
    );

    return response(200, { updated: true });
  }

  // DELETE /improvements — admin deletes entry
  if (method === 'DELETE' && path.includes('/improvements')) {
    const admin = await verifyAdmin(event);
    if (!admin) return response(401, { error: 'Unauthorized — admin required' });

    const body = parseBody(event);
    if (!body) return response(400, { error: 'Invalid JSON body' });

    const { repoName, promptId } = body;

    if (!repoName || !promptId) {
      return response(400, { error: 'repoName and promptId are required' });
    }

    await ddb.send(
      new DeleteCommand({
        TableName: TABLE,
        Key: { repoName, promptId },
      })
    );
    return response(200, { deleted: true });
  }

  return response(404, { error: 'Not found' });
}
