import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

@Injectable()
export class CustomValidationPipe implements PipeTransform<any> {
  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    // Chuyển đổi plain object -> instance của DTO
    const object = plainToInstance(metatype, value, {
      enableImplicitConversion: true, // tự convert kiểu
    });

    const errors = await validate(object, {
      whitelist: true, // loại bỏ field thừa không có trong DTO
      forbidNonWhitelisted: true, // báo lỗi nếu có field không mong muốn
    });

    if (errors.length > 0) {
      throw new BadRequestException(this.formatErrors(errors));
    }
    return object;
  }

  private toValidate(metatype: any): boolean {
    const types: any[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  private formatErrors(errors: any[]) {
    return errors.map((err) => ({
      field: err.property,
      errors: Object.values(err.constraints || {}),
    }));
  }
}
