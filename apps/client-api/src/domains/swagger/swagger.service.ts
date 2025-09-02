// src/swagger/swagger.service.ts
import { Injectable } from '@nestjs/common';

type OpRef = {
  method: string;
  path: string;
  summary?: string;
  tags?: string[];
  operationId?: string;
  parameters: Array<{
    name: string;
    in: string;
    required?: boolean;
    schema?: any;
  }>;
  hasRequestBody: boolean;
};

@Injectable()
export class SwaggerService {
  private spec: any | null = null;

  setSpec(spec: any) {
    this.spec = spec;
  }

  getSpec() {
    return this.spec;
  }

  listAllOperations(): OpRef[] {
    const out: OpRef[] = [];
    if (!this.spec?.paths) return out;

    for (const [path, methods] of Object.entries<any>(this.spec.paths)) {
      for (const [m, op] of Object.entries<any>(methods)) {
        const params = (op.parameters || []).map((p: any) => ({
          name: p.name,
          in: p.in,
          required: p.required,
          schema: p.schema,
        }));
        const hasBody = !!op.requestBody;
        out.push({
          method: m.toUpperCase(),
          path,
          summary: op.summary,
          tags: op.tags || [],
          operationId: op.operationId,
          parameters: params,
          hasRequestBody: hasBody,
        });
      }
    }
    return out;
  }
}
