import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class RequestPagingDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'page must be an integer' })
    @Min(1, { message: 'page must be greater than 0' })
    page: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'limit must be an integer' })
    @Min(1, { message: 'limit must be greater than 0' })
    limit: number = 10;

    @IsOptional()
    @IsString({ message: 'sortBy must be a string' })
    sortBy?: string;

    @IsOptional()
    @IsString({ message: 'sortOrder must be a string' })
    sortOrder?: 'asc' | 'desc' = 'asc';

    @IsOptional()
    @IsString({ message: 'search must be a string' })
    search?: string;
}
