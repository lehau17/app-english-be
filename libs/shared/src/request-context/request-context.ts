// request-context.ts
import { AsyncLocalStorage } from 'async_hooks';
import { JwtPayload } from '../payload';

interface IRequestContext {
  requestId?: string;
  user?: JwtPayload;
  path?: string;
  method?: string;
  ip?: string;
  [key: string]: any;
}

class RequestContext {
  private static storage = new AsyncLocalStorage<IRequestContext>();

  /**
   * Gọi hàm này ở middleware để khởi tạo context cho request mới
   */
  static run(context: IRequestContext, callback: () => void) {
    RequestContext.storage.run(context, callback);
  }

  /**
   * Lấy context hiện tại
   */
  static get(): IRequestContext {
    return RequestContext.storage.getStore() ?? {};
  }

  /**
   * Set một key trong context
   */
  static set(key: keyof IRequestContext, value: any) {
    const store = RequestContext.storage.getStore();
    if (store) {
      store[key] = value;
    }
  }

  /**
   * Lấy một key từ context
   */
  static getValue<T = any>(key: keyof IRequestContext): T | undefined {
    return RequestContext.storage.getStore()?.[key] as T | undefined;
  }
}

export { IRequestContext, RequestContext };
