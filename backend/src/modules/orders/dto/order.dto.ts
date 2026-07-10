import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class OrderItemDto {
  @IsUUID()
  variant_id!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateOrderDto {
  @IsUUID()
  customer_id!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @IsString()
  shipping_address!: string;

  @IsOptional()
  @IsString()
  shipping_method?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  shipping_cost?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discount_amount?: number;

  @IsOptional()
  @IsString()
  payment_method?: string;

  @IsOptional()
  @IsString()
  customer_notes?: string;
}

export class CreateShipmentDto {
  @IsOptional()
  @IsString()
  shipping_method?: string;

  @IsOptional()
  @IsString()
  receiver_address?: string;
}

export class OrderQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn([
    'pending',
    'confirmed',
    'packed',
    'shipped',
    'delivered',
    'completed',
    'returned',
    'cancelled',
  ])
  status?: string;

  @IsOptional()
  @IsUUID()
  customer_id?: string;
}
