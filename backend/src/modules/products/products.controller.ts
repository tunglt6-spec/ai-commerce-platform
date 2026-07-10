import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import {
  CreateProductDto,
  CreateVariantDto,
  ProductQueryDto,
  UpdateProductDto,
  UpdateStockDto,
} from './dto/product.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLES } from '../../common/constants/roles';
import { AuthenticatedUser } from '../../common/types/authenticated-user';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(ROLES.OPERATOR)
  async create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateProductDto) {
    const data = await this.productsService.create(tenantId, dto);
    return { success: true, data };
  }

  @Get()
  async findAll(@CurrentUser('tenantId') tenantId: string, @Query() query: ProductQueryDto) {
    const result = await this.productsService.findAll(tenantId, query);
    return { success: true, ...result };
  }

  @Get(':id')
  async findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    const data = await this.productsService.findOne(tenantId, id);
    return { success: true, data };
  }

  @Patch(':id')
  @Roles(ROLES.OPERATOR)
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    const data = await this.productsService.update(tenantId, id, dto);
    return { success: true, data };
  }

  @Delete(':id')
  @Roles(ROLES.MANAGER)
  async archive(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    const data = await this.productsService.archive(tenantId, id);
    return { success: true, data };
  }

  @Post(':id/variants')
  @Roles(ROLES.OPERATOR)
  async createVariant(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateVariantDto,
  ) {
    const data = await this.productsService.createVariant(tenantId, id, dto);
    return { success: true, data };
  }

  @Patch(':id/variants/:variantId/stock')
  @Roles(ROLES.OPERATOR)
  async updateStock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateStockDto,
  ) {
    const data = await this.productsService.updateStock(user.tenantId, id, variantId, dto, user.userId);
    return { success: true, data };
  }
}
