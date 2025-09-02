// Chuyển BigInt → string khi stringify
export const safeStringify = (obj: any, space: number = 2) =>
  JSON.stringify(
    obj,
    (_, v) => (typeof v === 'bigint' ? v.toString() : v),
    space,
  );

// Nếu cần object thuần (không BigInt), parse lại:
export const toPlainObject = <T>(obj: T): T => JSON.parse(safeStringify(obj));

export const normalizeBigInt = (value: any): any => {
  if (typeof value === 'bigint') return value.toString(); // hoặc Number(value) nếu chắc không overflow
  if (Array.isArray(value)) return value.map(normalizeBigInt);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, normalizeBigInt(v)]),
    );
  }
  return value;
};
