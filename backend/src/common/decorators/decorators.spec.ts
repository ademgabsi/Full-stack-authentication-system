import { Public, IS_PUBLIC_KEY } from './public.decorator';
import { Roles, ROLES_KEY } from './roles.decorator';

describe('Public decorator', () => {
  it('should set metadata with IS_PUBLIC_KEY and value true', () => {
    class TestClass {
      @Public()
      method() {}
    }

    const metadata = Reflect.getMetadata(IS_PUBLIC_KEY, TestClass.prototype.method);
    expect(metadata).toBe(true);
  });

  it('should not interfere with other metadata', () => {
    class TestClass {
      @Public()
      method() {}

      normalMethod() {}
    }

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, TestClass.prototype.method)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, TestClass.prototype.normalMethod)).toBeUndefined();
  });
});

describe('Roles decorator', () => {
  it('should set ROLES_KEY metadata with the provided roles', () => {
    class TestClass {
      @Roles('admin')
      method() {}
    }

    const metadata = Reflect.getMetadata(ROLES_KEY, TestClass.prototype.method);
    expect(metadata).toEqual(['admin']);
  });

  it('should support multiple roles', () => {
    class TestClass {
      @Roles('admin', 'superadmin', 'moderator')
      method() {}
    }

    const metadata = Reflect.getMetadata(ROLES_KEY, TestClass.prototype.method);
    expect(metadata).toEqual(['admin', 'superadmin', 'moderator']);
  });

  it('should set empty array when no roles provided', () => {
    class TestClass {
      @Roles()
      method() {}
    }

    const metadata = Reflect.getMetadata(ROLES_KEY, TestClass.prototype.method);
    expect(metadata).toEqual([]);
  });

  it('should not interfere across different decorators', () => {
    class TestClass {
      @Roles('admin')
      adminMethod() {}

      @Public()
      publicMethod() {}
    }

    expect(Reflect.getMetadata(ROLES_KEY, TestClass.prototype.adminMethod)).toEqual(['admin']);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, TestClass.prototype.publicMethod)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, TestClass.prototype.adminMethod)).toBeUndefined();
    expect(Reflect.getMetadata(ROLES_KEY, TestClass.prototype.publicMethod)).toBeUndefined();
  });
});
