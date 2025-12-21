# API Standards Reference

## RESTful API Design

### URL Structure
```
Good:
GET  /users
GET  /users/{id}
POST /users
PUT  /users/{id}
DELETE /users/{id}
GET  /users/{id}/orders

Bad:
GET  /getUsers
POST /createUser
GET  /users/delete/{id}
```

### HTTP Methods
| Method | Purpose | Idempotent | Safe |
|--------|---------|------------|------|
| GET | Retrieve resource | Yes | Yes |
| POST | Create resource | No | No |
| PUT | Replace resource | Yes | No |
| PATCH | Partial update | No | No |
| DELETE | Remove resource | Yes | No |

### HTTP Status Codes
| Code | Meaning | Use Case |
|------|---------|----------|
| 200 | OK | Successful GET/PUT/PATCH |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Validation error |
| 401 | Unauthorized | Missing/invalid auth |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource conflict |
| 422 | Unprocessable | Semantic error |
| 429 | Too Many Requests | Rate limited |
| 500 | Server Error | Internal failure |

## Request/Response Standards

### Request Headers
```http
Content-Type: application/json
Accept: application/json
Authorization: Bearer <token>
X-Request-ID: <uuid>
X-API-Version: 2024-01-01
```

### Response Format
```json
{
  "data": {
    "id": "123",
    "type": "user",
    "attributes": {
      "name": "John Doe",
      "email": "john@example.com"
    }
  },
  "meta": {
    "request_id": "abc-123",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Error Response Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ],
    "request_id": "abc-123"
  }
}
```

### Pagination
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 150,
    "total_pages": 8,
    "next": "/users?page=2",
    "prev": null
  }
}
```

## API Versioning

### Strategies
| Strategy | Example | Pros | Cons |
|----------|---------|------|------|
| URL Path | /v1/users | Clear, cacheable | URL changes |
| Header | X-API-Version: 1 | Clean URLs | Less discoverable |
| Query Param | /users?version=1 | Easy to test | Caching issues |
| Date-based | 2024-01-01 | Fine-grained | Complex |

### Deprecation Policy
```
1. Announce deprecation 6 months in advance
2. Return deprecation headers
3. Maintain old version for transition
4. Remove after migration deadline
```

Deprecation Headers:
```http
Deprecation: true
Sunset: Sat, 01 Jan 2025 00:00:00 GMT
Link: <https://docs.api.com/deprecations>; rel="deprecation"
```

## Authentication

### Bearer Token (JWT)
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

JWT Requirements:
- [ ] Short expiration (15 min for access tokens)
- [ ] Refresh token rotation
- [ ] Include minimal claims
- [ ] Verify signature and expiration
- [ ] Use RS256 or ES256 (asymmetric)

### API Keys
```http
X-API-Key: sk_live_abc123...
```

API Key Requirements:
- [ ] Environment-specific keys (test/live)
- [ ] Rotation capability
- [ ] Scope limitations
- [ ] Usage tracking

## Rate Limiting

### Response Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
Retry-After: 60
```

### Limits by Tier
| Tier | Requests/min | Burst |
|------|-------------|-------|
| Free | 60 | 10 |
| Basic | 300 | 50 |
| Pro | 1000 | 100 |
| Enterprise | Custom | Custom |

## Input Validation

### Requirements
- [ ] Type validation
- [ ] Length limits
- [ ] Format validation (email, URL)
- [ ] Range validation (numbers, dates)
- [ ] Required field validation
- [ ] Enum validation

### OpenAPI Schema Example
```yaml
components:
  schemas:
    CreateUser:
      type: object
      required:
        - email
        - name
      properties:
        email:
          type: string
          format: email
          maxLength: 255
        name:
          type: string
          minLength: 1
          maxLength: 100
        age:
          type: integer
          minimum: 0
          maximum: 150
```

## API Documentation

### OpenAPI Specification
```yaml
openapi: 3.1.0
info:
  title: User API
  version: 1.0.0
  description: API for user management
  
servers:
  - url: https://api.example.com/v1
    description: Production
  - url: https://api-staging.example.com/v1
    description: Staging

paths:
  /users:
    get:
      summary: List users
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserList'
```

### Documentation Requirements
- [ ] All endpoints documented
- [ ] Request/response examples
- [ ] Authentication explained
- [ ] Error codes documented
- [ ] Rate limits documented
- [ ] Changelog maintained

## API Security Checklist

- [ ] HTTPS only
- [ ] Authentication required
- [ ] Input validation
- [ ] Output encoding
- [ ] Rate limiting
- [ ] CORS properly configured
- [ ] Security headers set
- [ ] Sensitive data masked in logs
- [ ] SQL injection prevention
- [ ] Request size limits

## API Testing Checklist

- [ ] Happy path tests
- [ ] Error handling tests
- [ ] Authentication tests
- [ ] Authorization tests
- [ ] Rate limiting tests
- [ ] Input validation tests
- [ ] Pagination tests
- [ ] Contract tests
- [ ] Performance tests
