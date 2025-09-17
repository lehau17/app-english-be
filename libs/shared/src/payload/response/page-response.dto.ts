export class PageResponseDto<T> {
  data: T[];
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;

  constructor(partial: Partial<PageResponseDto<T>>) {
    Object.assign(this, partial);
  }

  static of<T>(
    data: T[],
    page: number,
    limit: number,
    totalItems: number,
  ): PageResponseDto<T> {
    const totalPages = Math.ceil(totalItems / limit);
    return new PageResponseDto<T>({
      data,
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages || false,
      hasPrevPage: page > 1 || false,
    });
  }
}
