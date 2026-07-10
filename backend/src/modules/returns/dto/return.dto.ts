import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateReturnDto {
  @IsIn(['quality', 'wrong_size', 'not_as_described', 'damaged', 'other'])
  reason!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateReturnDto {
  @IsIn(['approved', 'rejected', 'received', 'refunded'])
  status!: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  refund_amount?: number;
}

export class ReturnQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(['requested', 'approved', 'rejected', 'received', 'refunded'])
  status?: string;
}
