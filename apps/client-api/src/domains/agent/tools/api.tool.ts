// src/tools/api.tool.ts
import { RequestContext } from '@app/shared';
import { StructuredTool } from '@langchain/core/tools';
import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosRequestConfig } from 'axios';
import { z } from 'zod';
import { SwaggerService } from '../../swagger/swagger.service';

const SAFE_METHODS = new Set(['GET']); // mặc định chỉ GET
const ALLOW_WRITE = process.env.AGENT_ALLOW_WRITE === 'true'; // bật POST/PATCH/DELETE nếu muốn

@Injectable()
export class ApiTool extends StructuredTool {
  name = 'call_api';
  description =
    'Gọi API nội bộ qua method+path (không cần operationId). Tự gắn Authorization từ RequestContext.';
  schema = z.object({
    method: z
      .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
      .describe('HTTP method'),
    path: z
      .string()
      .describe('Đường dẫn đúng như trong Swagger, vd: /students/{id}'),
    pathParams: z.record(z.any()).optional(),
    query: z.record(z.any()).optional(),
    body: z.any().optional(),
    headers: z.record(z.any()).optional(),
  });

  private readonly logger = new Logger(ApiTool.name);
  constructor(private swagger: SwaggerService) {
    super();
  }

  private resolvePath(path: string, pathParams: Record<string, any>) {
    return path.replace(/{(\w+)}/g, (_, key) => {
      if (!(key in pathParams)) throw new Error(`Thiếu path param: ${key}`);
      return encodeURIComponent(String(pathParams[key]));
    });
  }

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const {
        method,
        path,
        pathParams = {},
        query = {},
        body,
        headers = {},
      } = input;

      // 1) Chặn ghi nếu chưa bật
      if (!SAFE_METHODS.has(method) && !ALLOW_WRITE) {
        return JSON.stringify({
          success: false,
          error: `Method ${method} bị chặn (chưa bật AGENT_ALLOW_WRITE=true)`,
        });
      }

      // 2) Xác thực method+path tồn tại trong spec
      const ops = this.swagger.listAllOperations();
      const exists = ops.find((op) => op.method === method && op.path === path);
      if (!exists) {
        return JSON.stringify({
          success: false,
          error: `Không tìm thấy endpoint ${method} ${path} trong Swagger`,
        });
      }

      // 3) Render path params
      let fullPath = path;
      if (/{\w+}/.test(path)) {
        fullPath = this.resolvePath(path, pathParams);
      }

      // 4) Base URL + Authorization
      const base = process.env.API_BASE_URL || 'http://localhost:3000';
      const url = base + fullPath;

      const ctxAuth = RequestContext.getValue<string>('authorization') || '';
      const fallback = process.env.AGENT_FALLBACK_BEARER
        ? `Bearer ${process.env.AGENT_FALLBACK_BEARER}`
        : '';
      const authHeader =
        headers['authorization'] ||
        headers['Authorization'] ||
        ctxAuth ||
        fallback;

      const cfg: AxiosRequestConfig = {
        url,
        method: method as any,
        params: query,
        data: body,
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
          ...headers,
        },
      };

      this.logger.log(`🌐 ${method} ${url}`);
      const { data } = await axios(cfg);
      return JSON.stringify({ success: true, method, path, url, data });
    } catch (e: any) {
      this.logger.error(`❌ API call error: ${e?.message}`);
      return JSON.stringify({
        success: false,
        error: `API call error: ${e?.message}`,
      });
    }
  }
}
