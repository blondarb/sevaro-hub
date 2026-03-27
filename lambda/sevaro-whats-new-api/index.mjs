import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  DeleteCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

const client = new DynamoDBClient({ region: 'us-east-2' });
const ddb = DynamoDBDocumentClient.from(client);
const TABLE = 'sevaro-whats-new';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'steve@sevaro.com')
  .split(',')
  .map((e) => e.trim().toLowerCase());

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || 'us-east-2_9y6XyJnXC';
const CLIENT_ID = process.env.COGNITO_CLIENT_ID || '2ejoumofnhhd3133gv9e9i6r1h';

const verifier = CognitoJwtVerifier.create({
  userPoolId: USER_POOL_ID,
  tokenUse: 'id',
  clientId: CLIENT_ID,
});

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
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

function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

// Verify Cognito JWT signature + claims, then check admin email
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

export async function handler(event) {
  const method = event.httpMethod || event.requestContext?.http?.method;
  const path = event.path || event.rawPath || '';

  // CORS preflight
  if (method === 'OPTIONS') return response(200, {});

  // GET /whats-new — public, returns updates for an app
  if (method === 'GET' && path.endsWith('/whats-new')) {
    const params = event.queryStringParameters || {};
    const appId = params.appId;
    const since = params.since;

    if (!appId) {
      return response(400, { error: 'appId query parameter is required' });
    }

    // Query for app-specific entries
    const queryParams = {
      TableName: TABLE,
      KeyConditionExpression: since
        ? 'appId = :appId AND #ts >= :since'
        : 'appId = :appId',
      ExpressionAttributeValues: { ':appId': appId },
      ScanIndexForward: false, // newest first
    };
    if (since) {
      queryParams.ExpressionAttributeNames = { '#ts': 'timestamp' };
      queryParams.ExpressionAttributeValues[':since'] = since;
    }

    const appResult = await ddb.send(new QueryCommand(queryParams));
    let items = appResult.Items || [];

    // Also query "all" entries if appId !== "all"
    if (appId !== 'all') {
      const allParams = {
        TableName: TABLE,
        KeyConditionExpression: since
          ? 'appId = :appId AND #ts >= :since'
          : 'appId = :appId',
        ExpressionAttributeValues: { ':appId': 'all' },
        ScanIndexForward: false,
      };
      if (since) {
        allParams.ExpressionAttributeNames = { '#ts': 'timestamp' };
        allParams.ExpressionAttributeValues[':since'] = since;
      }
      const allResult = await ddb.send(new QueryCommand(allParams));
      items = [...items, ...(allResult.Items || [])];
    }

    // Sort by timestamp descending and strip internal fields for public response
    items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const publicItems = items.map(({ createdBy, ...rest }) => rest);

    return response(200, { updates: publicItems });
  }

  // GET /whats-new/all — admin only, returns all entries across all apps
  if (method === 'GET' && path.endsWith('/whats-new/all')) {
    const admin = await verifyAdmin(event);
    if (!admin) return response(401, { error: 'Unauthorized — admin required' });

    const result = await ddb.send(new ScanCommand({ TableName: TABLE }));
    const items = (result.Items || []).sort(
      (a, b) => b.timestamp.localeCompare(a.timestamp)
    );
    return response(200, { updates: items });
  }

  // POST /whats-new — admin creates entry
  if (method === 'POST' && path.endsWith('/whats-new')) {
    const admin = await verifyAdmin(event);
    if (!admin) return response(401, { error: 'Unauthorized — admin required' });

    const body = parseBody(event);
    if (!body) return response(400, { error: 'Invalid JSON body' });

    const { appId, title, description, category, version, link } = body;

    if (!appId || !title || !description || !category) {
      return response(400, {
        error: 'appId, title, description, and category are required',
      });
    }

    if (!['fix', 'feature', 'improvement'].includes(category)) {
      return response(400, {
        error: 'category must be fix, feature, or improvement',
      });
    }

    if (link && !isValidUrl(link)) {
      return response(400, { error: 'link must be a valid http or https URL' });
    }

    const now = new Date().toISOString();
    const item = {
      appId,
      timestamp: now,
      title,
      description,
      category,
      createdBy: admin.email,
      createdAt: now,
    };
    if (version) item.version = version;
    if (link) item.link = link;

    await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
    return response(201, { update: item });
  }

  // DELETE /whats-new — admin deletes entry
  if (method === 'DELETE' && path.includes('/whats-new')) {
    const admin = await verifyAdmin(event);
    if (!admin) return response(401, { error: 'Unauthorized — admin required' });

    const body = parseBody(event);
    if (!body) return response(400, { error: 'Invalid JSON body' });

    const { appId, timestamp } = body;

    if (!appId || !timestamp) {
      return response(400, { error: 'appId and timestamp are required' });
    }

    await ddb.send(
      new DeleteCommand({
        TableName: TABLE,
        Key: { appId, timestamp },
      })
    );
    return response(200, { deleted: true });
  }

  return response(404, { error: 'Not found' });
}
