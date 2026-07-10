import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLES } from '../../common/constants/roles';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @Roles(ROLES.OPERATOR)
  async create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateCategoryDto) {
    const data = await this.categoriesService.create(tenantId, dto);
    return { success: true, data };
  }

  @Get()
  async findAll(@CurrentUser('tenantId') tenantId: string) {
    const data = await this.categoriesService.findAll(tenantId);
    return { success: true, data };
  }

  @Get(':id')
  async findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    const data = await this.categoriesService.findOne(tenantId, id);
    return { success: true, data };
  }

  @Patch(':id')
  @Roles(ROLES.OPERATOR)
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    const data = await this.categoriesService.update(tenantId, id, dto);
    return { success: true, data };
  }

  @Delete(':id')
  @Roles(ROLES.MANAGER)
  async remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    const data = await this.categoriesService.remove(tenantId, id);
    return { success: true, data };
  }
}
