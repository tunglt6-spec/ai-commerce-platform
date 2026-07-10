import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, CustomerQueryDto, UpdateCustomerDto } from './dto/customer.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLES } from '../../common/constants/roles';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @Roles(ROLES.OPERATOR)
  async create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateCustomerDto) {
    const data = await this.customersService.create(tenantId, dto);
    return { success: true, data };
  }

  @Get()
  async findAll(@CurrentUser('tenantId') tenantId: string, @Query() query: CustomerQueryDto) {
    const result = await this.customersService.findAll(tenantId, query);
    return { success: true, ...result };
  }

  @Get(':id')
  async findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    const data = await this.customersService.findOne(tenantId, id);
    return { success: true, data };
  }

  @Patch(':id')
  @Roles(ROLES.OPERATOR)
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    const data = await this.customersService.update(tenantId, id, dto);
    return { success: true, data };
  }
}
