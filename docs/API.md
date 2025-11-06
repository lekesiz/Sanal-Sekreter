# NETZ Sanal Sekreter - API Documentation

## Base URL

```
Development: http://localhost:3000/api
Production: https://your-domain.com/api
```

## Authentication

Most endpoints require authentication via JWT token or API key.

```http
Authorization: Bearer <token>
```

or

```http
X-API-Key: <api-key>
```

---

## Endpoints

### Health Check

Check system health and status.

```http
GET /health
```

**Response**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-06T10:30:00Z",
  "environment": "production",
  "version": "1.0.0"
}
```

---

### Calls

#### Get All Calls

```http
GET /api/calls
```

**Query Parameters**
- `status` (optional): Filter by status (`in-progress`, `completed`, `failed`)
- `from` (optional): Start date (ISO 8601)
- `to` (optional): End date (ISO 8601)
- `limit` (optional): Number of results (default: 50, max: 100)
- `offset` (optional): Pagination offset

**Response**
```json
{
  "calls": [
    {
      "id": "uuid",
      "callSid": "CA123...",
      "fromNumber": "+33123456789",
      "toNumber": "+33987654321",
      "status": "completed",
      "duration": 180,
      "startTime": "2025-01-06T10:00:00Z",
      "endTime": "2025-01-06T10:03:00Z"
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

#### Get Call Details

```http
GET /api/calls/:id
```

**Response**
```json
{
  "id": "uuid",
  "callSid": "CA123...",
  "fromNumber": "+33123456789",
  "toNumber": "+33987654321",
  "direction": "inbound",
  "status": "completed",
  "startTime": "2025-01-06T10:00:00Z",
  "endTime": "2025-01-06T10:03:00Z",
  "duration": 180,
  "recordingUrl": "https://...",
  "transcript": [...],
  "intents": [...],
  "handoff": {...}
}
```

#### Get Call Transcript

```http
GET /api/calls/:id/transcript
```

**Response**
```json
{
  "callId": "uuid",
  "transcript": [
    {
      "speaker": "system",
      "text": "Bonjour, NETZ Informatique. Comment puis-je vous aider?",
      "timestamp": 0,
      "language": "fr-FR"
    },
    {
      "speaker": "caller",
      "text": "Mon ordinateur ne démarre plus.",
      "timestamp": 3500,
      "language": "fr-FR",
      "confidence": 0.95
    }
  ]
}
```

---

### Webhooks

#### Twilio Voice Webhook

```http
POST /api/webhooks/twilio/voice
```

**Request Body (Form Data)**
```
CallSid=CA123...
From=+33123456789
To=+33987654321
CallStatus=ringing
```

**Response (TwiML)**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="fr-FR">Bonjour, NETZ Informatique</Say>
  <Gather input="speech" language="fr-FR" speechTimeout="auto">
    <Say>Comment puis-je vous aider?</Say>
  </Gather>
</Response>
```

#### Twilio Status Callback

```http
POST /api/webhooks/twilio/status
```

#### Dialogflow Webhook

```http
POST /api/webhooks/dialogflow
```

---

### Admin

#### Get System Metrics

```http
GET /api/admin/metrics
```

**Response**
```json
{
  "calls": {
    "total": 1500,
    "today": 45,
    "inProgress": 3,
    "avgDuration": 180
  },
  "intents": {
    "topIntents": [
      { "name": "technical_support", "count": 450 },
      { "name": "business_hours", "count": 320 }
    ]
  },
  "rag": {
    "totalQueries": 890,
    "avgConfidence": 0.85,
    "hitRate": 0.75
  },
  "agents": {
    "online": 5,
    "busy": 2,
    "offline": 3
  }
}
```

#### Reindex RAG Documents

```http
POST /api/admin/rag/reindex
```

**Request Body**
```json
{
  "source": "drive",
  "fullReindex": false
}
```

**Response**
```json
{
  "status": "started",
  "jobId": "uuid",
  "estimatedTime": "5 minutes"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { ... }
  }
}
```

### Error Codes

- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

---

## Rate Limiting

API requests are rate-limited to:
- **Public endpoints**: 100 requests per minute
- **Authenticated endpoints**: 1000 requests per minute

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1609459200
```

---

## Webhooks Security

All webhooks include signature verification:

### Twilio
Verify using `X-Twilio-Signature` header with your auth token.

### Dialogflow
Verify using Google Cloud authentication.

---

## Examples

### cURL

```bash
# Get all calls
curl -X GET https://api.example.com/api/calls \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get call details
curl -X GET https://api.example.com/api/calls/uuid \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### JavaScript

```javascript
const response = await fetch('https://api.example.com/api/calls', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
```

---

For more information, contact: contact@netzinformatique.fr
