import {
  TransformInterceptor,
} from './transform.interceptor';
import { of } from 'rxjs';
import { ExecutionContext, CallHandler } from '@nestjs/common';

function createMockContext(statusCode: number = 200) {
  const response = { statusCode } as any;
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({}),
      getNext: jest.fn(),
    }),
  } as unknown as ExecutionContext;
}

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<any>;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  it('should wrap response data with statusCode and message', () => {
    const ctx = createMockContext(200);
    const callHandler: CallHandler = {
      handle: () => of({ items: [1, 2, 3] }),
    };

    interceptor.intercept(ctx, callHandler).subscribe((result) => {
      expect(result).toEqual({
        statusCode: 200,
        data: { items: [1, 2, 3] },
        message: 'Success',
      });
    });
  });

  it('should handle null data', () => {
    const ctx = createMockContext(204);
    const callHandler: CallHandler = {
      handle: () => of(null),
    };

    interceptor.intercept(ctx, callHandler).subscribe((result) => {
      expect(result).toEqual({
        statusCode: 204,
        data: null,
        message: 'Success',
      });
    });
  });

  it('should use the response status code', () => {
    const ctx = createMockContext(201);
    const callHandler: CallHandler = {
      handle: () => of({ id: 'new-1' }),
    };

    interceptor.intercept(ctx, callHandler).subscribe((result) => {
      expect(result.statusCode).toBe(201);
    });
  });

  it('should wrap primitive data', () => {
    const ctx = createMockContext(200);
    const callHandler: CallHandler = {
      handle: () => of('hello'),
    };

    interceptor.intercept(ctx, callHandler).subscribe((result) => {
      expect(result.data).toBe('hello');
    });
  });
});
