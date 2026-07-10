import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto, CreateShipmentDto, OrderQueryDto } from './dto/order.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLES } from '../../common/constants/roles';
import { AuthenticatedUser } from '../../common/types/authenticated-user';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Roles(ROLES.OPERATOR)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrderDto) {
    const data = await this.ordersService.create(user.tenantId, dto, user.userId);
    return { success: true, data };
  }

  @Get()
  async findAll(@CurrentUser('tenantId') tenantId: string, @Query() query: OrderQueryDto) {
    const result = await this.ordersService.findAll(tenantId, query);
    return { success: true, ...result };
  }

  @Get(':id')
  async findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    const data = await this.ordersService.findOne(tenantId, id);
    return { success: true, data };
  }

  @Patch(':id/confirm')
  @Roles(ROLES.OPERATOR)
  async confirm(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    const data = await this.ordersService.confirm(tenantId, id);
    return { success: true, data };
  }

  @Post(':id/shipments')
  @Roles(ROLES.OPERATOR)
  async ship(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateShipmentDto,
  ) {
    const data = await this.ordersService.ship(tenantId, id, dto);
    return { success: true, data };
  }

  @Patch(':id/cancel')
  @Roles(ROLES.MANAGER)
  async cancel(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    const data = await this.ordersService.cancel(tenantId, id);
    return { success: true, data };
  }
}
