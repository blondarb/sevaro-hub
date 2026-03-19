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
const PROMPTS_TABLE = 'sevaro-prompt-registry';
const FEEDBACK_TABLE = 'sevaro-prompt-feedback';

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

const VALID_CATEGORIES = ['system-prompt', 'improvement', 'fix', 'feature'];
const VALID_STATUSES = ['draft', 'active', 'deployed', 'archived'];

export async function handler(event) {
  const method = event.httpMethod || event.requestContext?.http?.method;
  const path = event.path || event.rawPath || '';

  if (method === 'OPTIONS') return response(200, {});

  // ── Prompt CRUD ──

  // GET /prompts — list all prompts
  if (method === 'GET' && path.endsWith('/prompts')) {
    const admin = await verifyAdmin(event);
    if (!admin) return response(401, { error: 'Unauthorized — admin required' });

    const params = event.queryStringParameters || {};
    const { appName, category, status } = params;

    let items;
    if (appName) {
      const result = await ddb.send(new QueryCommand({
        TableName: PROMPTS_TABLE,
        KeyConditionExpression: 'appName = :app',
        ExpressionAttributeValues: { ':app': appName },
      }));
      items = result.Items || [];
    } else {
      const result = await ddb.send(new ScanCommand({ TableName: PROMPTS_TABLE }));
      items = result.Items || [];
    }

    if (category) items = items.filter((i) => i.category === category);
    if (status) items = items.filter((i) => i.status === status);

    items.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    return response(200, { prompts: items });
  }

  // POST /prompts — register new prompt
  if (method === 'POST' && path.endsWith('/prompts')) {
    const admin = await verifyAdmin(event);
    if (!admin) return response(401, { error: 'Unauthorized — admin required' });

    const body = parseBody(event);
    if (!body) return response(400, { error: 'Invalid JSON body' });

    const { appName, promptId, title, category, feature, promptText, sourceFile, aiSummary } = body;
    if (!appName || !promptId || !title || !promptText) {
      return response(400, { error: 'appName, promptId, title, and promptText are required' });
    }

    const itemCategory = category || 'system-prompt';
    if (!VALID_CATEGORIES.includes(itemCategory)) {
      return response(400, { error: 'category must be system-prompt, improvement, fix, or feature' });
    }

    const now = new Date().toISOString();
    const item = {
      appName,
      promptId,
      title,
      category: itemCategory,
      status: body.status || 'active',
      feature: feature || '',
      promptText,
      currentVersion: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: admin.email,
    };
    if (sourceFile) item.sourceFile = sourceFile;
    if (aiSummary) item.aiSummary = aiSummary;

    await ddb.send(new PutCommand({ TableName: PROMPTS_TABLE, Item: item }));
    return response(201, { prompt: item });
  }

  // PATCH /prompts — update prompt
  if (method === 'PATCH' && path.endsWith('/prompts')) {
    const admin = await verifyAdmin(event);
    if (!admin) return response(401, { error: 'Unauthorized — admin required' });

    const body = parseBody(event);
    if (!body) return response(400, { error: 'Invalid JSON body' });

    const { appName, promptId, ...updates } = body;
    if (!appName || !promptId) {
      return response(400, { error: 'appName and promptId are required' });
    }

    const allowedFields = ['title', 'category', 'status', 'feature', 'promptText', 'sourceFile', 'aiSummary', 'currentVersion'];
    const expressionParts = ['#updatedAt = :updatedAt'];
    const exprNames = { '#updatedAt': 'updatedAt' };
    const exprValues = { ':updatedAt': new Date().toISOString() };

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        expressionParts.push(`#${field} = :${field}`);
        exprNames[`#${field}`] = field;
        exprValues[`:${field}`] = updates[field];
      }
    }

    await ddb.send(new UpdateCommand({
      TableName: PROMPTS_TABLE,
      Key: { appName, promptId },
      UpdateExpression: `SET ${expressionParts.join(', ')}`,
      ExpressionAttributeNames: exprNames,
      ExpressionAttributeValues: exprValues,
    }));

    return response(200, { updated: true });
  }

  // DELETE /prompts
  if (method === 'DELETE' && path.endsWith('/prompts')) {
    const admin = await verifyAdmin(event);
    if (!admin) return response(401, { error: 'Unauthorized — admin required' });

    const body = parseBody(event);
    if (!body) return response(400, { error: 'Invalid JSON body' });

    const { appName, promptId } = body;
    if (!appName || !promptId) {
      return response(400, { error: 'appName and promptId are required' });
    }

    await ddb.send(new DeleteCommand({ TableName: PROMPTS_TABLE, Key: { appName, promptId } }));
    return response(200, { deleted: true });
  }

  // ── Feedback ──

  // GET /prompts/feedback?promptKey=...
  if (method === 'GET' && path.endsWith('/prompts/feedback')) {
    const admin = await verifyAdmin(event);
    if (!admin) return response(401, { error: 'Unauthorized — admin required' });

    const params = event.queryStringParameters || {};
    const { promptKey } = params;
    if (!promptKey) return response(400, { error: 'promptKey query param required' });

    const result = await ddb.send(new QueryCommand({
      TableName: FEEDBACK_TABLE,
      KeyConditionExpression: 'promptKey = :pk',
      ExpressionAttributeValues: { ':pk': promptKey },
      ScanIndexForward: false,
    }));

    return response(200, { feedback: result.Items || [] });
  }

  // POST /prompts/feedback
  if (method === 'POST' && path.endsWith('/prompts/feedback')) {
    const admin = await verifyAdmin(event);
    if (!admin) return response(401, { error: 'Unauthorized — admin required' });

    const body = parseBody(event);
    if (!body) return response(400, { error: 'Invalid JSON body' });

    const { promptKey, feedbackText, feedbackType } = body;
    if (!promptKey || !feedbackText) {
      return response(400, { error: 'promptKey and feedbackText are required' });
    }

    const now = new Date().toISOString();
    const item = {
      promptKey,
      feedbackId: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      feedbackText,
      feedbackType: feedbackType || 'text',
      refinementStatus: 'pending',
      createdAt: now,
      createdBy: admin.email,
    };

    await ddb.send(new PutCommand({ TableName: FEEDBACK_TABLE, Item: item }));
    return response(201, { feedback: item });
  }

  // PATCH /prompts/feedback — update feedback (store refinement result)
  if (method === 'PATCH' && path.endsWith('/prompts/feedback')) {
    const admin = await verifyAdmin(event);
    if (!admin) return response(401, { error: 'Unauthorized — admin required' });

    const body = parseBody(event);
    if (!body) return response(400, { error: 'Invalid JSON body' });

    const { promptKey, feedbackId, refinedPromptText, changeSummary, refinementStatus } = body;
    if (!promptKey || !feedbackId) {
      return response(400, { error: 'promptKey and feedbackId are required' });
    }

    const expressionParts = [];
    const exprNames = {};
    const exprValues = {};

    if (refinedPromptText !== undefined) {
      expressionParts.push('#rpt = :rpt');
      exprNames['#rpt'] = 'refinedPromptText';
      exprValues[':rpt'] = refinedPromptText;
    }
    if (changeSummary !== undefined) {
      expressionParts.push('#cs = :cs');
      exprNames['#cs'] = 'changeSummary';
      exprValues[':cs'] = changeSummary;
    }
    if (refinementStatus !== undefined) {
      expressionParts.push('#rs = :rs');
      exprNames['#rs'] = 'refinementStatus';
      exprValues[':rs'] = refinementStatus;
    }

    if (expressionParts.length === 0) {
      return response(400, { error: 'No fields to update' });
    }

    await ddb.send(new UpdateCommand({
      TableName: FEEDBACK_TABLE,
      Key: { promptKey, feedbackId },
      UpdateExpression: `SET ${expressionParts.join(', ')}`,
      ExpressionAttributeNames: exprNames,
      ExpressionAttributeValues: exprValues,
    }));

    return response(200, { updated: true });
  }

  return response(404, { error: 'Not found' });
}
