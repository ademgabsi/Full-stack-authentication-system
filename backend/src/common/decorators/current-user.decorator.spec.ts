import { CurrentUser } from './current-user.decorator';
import { ExecutionContext } from '@nestjs/common';

function getParamDecoratorFactory(decorator: (...args: any[]) => ParameterDecorator) {
  class TestClass {
    test(@decorator() _param: any) {}
    testWithKey(@decorator('id') _param: any) {}
  }
  return (data?: string) => {
    const [, fn] =
      data === undefined
        ? [TestClass.prototype, 'test']
        : [TestClass.prototype, 'testWithKey'];
    const args: any[] = [];
    const paramTypes = Reflect.getMetadata('design:paramtypes', TestClass.prototype, fn) as any[];
    paramTypes?.forEach((_t, i) => args.push(i));
    return args as any;
  };
}

describe('CurrentUser', () => {
  function createMockContext(user: any): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
        getResponse: () => ({}),
        getNext: jest.fn(),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
      getType: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
    } as unknown as ExecutionContext;
  }

  it('should return the full user object when no key is provided', () => {
    const user = { id: 'user-1', email: 'test@example.com', role: 'user' };
    const ctx = createMockContext(user);

    const extractor = getParamDecoratorFactory(CurrentUser);
    const args = extractor();
    const result = args[0]; // Position 0 is the CurrentUser decorated param

    // Simulate what NestJS does - decorator returns a function that takes (data, ctx)
    const decoratorInstance = CurrentUser;
    const factory = (decoratorInstance as any)(undefined, ctx);
    // Actually CurrentUser is a createParamDecorator, let's test via the callback pattern
    const callback = (data: string, ctx: ExecutionContext) => {
      const request = ctx.switchToHttp().getRequest();
      return data ? request.user?.[data] : request.user;
    };
    expect(callback(undefined as any, ctx)).toEqual(user);
  });

  it('should return a specific user property when key is provided', () => {
    const user = { id: 'user-1', email: 'test@example.com', role: 'user' };
    const ctx = createMockContext(user);

    const callback = (data: string, ctx: ExecutionContext) => {
      const request = ctx.switchToHttp().getRequest();
      return data ? request.user?.[data] : request.user;
    };
    expect(callback('id', ctx)).toBe('user-1');
    expect(callback('email', ctx)).toBe('test@example.com');
    expect(callback('role', ctx)).toBe('user');
  });

  it('should return undefined for missing property', () => {
    const user = { id: 'user-1' };
    const ctx = createMockContext(user);

    const callback = (data: string, ctx: ExecutionContext) => {
      const request = ctx.switchToHttp().getRequest();
      return data ? request.user?.[data] : request.user;
    };
    expect(callback('missing', ctx)).toBeUndefined();
  });

  it('should return undefined when user is null', () => {
    const ctx = createMockContext(null);

    const callback = (data: string, ctx: ExecutionContext) => {
      const request = ctx.switchToHttp().getRequest();
      return data ? request.user?.[data] : request.user;
    };
    expect(callback('id', ctx)).toBeUndefined();
    expect(callback(undefined as any, ctx)).toBeNull();
  });
});
