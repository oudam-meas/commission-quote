import { bodyLimit } from 'hono/body-limit';
import { HTTPException } from 'hono/http-exception';
import type { MiddlewareHandler } from 'hono';

// A valid request body here is a few dozen bytes. This is generous headroom,
// not a real ceiling on legitimate use.
const maxBodySize = 10_000;

export function bodyLimitMiddleware(): MiddlewareHandler {
  return bodyLimit({
    maxSize: maxBodySize,
    onError: () => {
      throw new HTTPException(413, {
        cause: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' },
      });
    },
  });
}
