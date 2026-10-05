import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { OutletTypesService } from './outlet-types.service';
import { CreateOutletTypeDto, UpdateOutletTypeDto } from './dto/outlet-type.dto';

@ApiTags('Admin Outlet Types')
@Controller('admin/outlet-types')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class OutletTypesController {
  constructor(private readonly outletTypesService: OutletTypesService) {}

  @Get()
  @ApiOperation({ summary: 'List all outlet types (incl. deactivated) with assigned outlet counts' })
  @ApiResponse({ status: 200, description: 'Outlet types with outlet counts' })
  async list() {
    const data = await this.outletTypesService.listForAdmin();
    return { message: `Retrieved ${data.length} outlet type(s)`, data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new outlet type (e.g. Restaurant, Grocery, Pharmacy)' })
  @ApiResponse({ status: 201, description: 'Outlet type created' })
  async create(@Body() dto: CreateOutletTypeDto) {
    const data = await this.outletTypesService.create(dto);
    return { message: `Outlet type "${data.name}" created`, data };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update an outlet type (rename, slug, ordering) or toggle customer visibility' })
  @ApiResponse({ status: 200, description: 'Outlet type updated' })
  async update(@Param('id') id: string, @Body() dto: UpdateOutletTypeDto) {
    const data = await this.outletTypesService.update(id, dto);
    return { message: `Outlet type "${data.name}" updated`, data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an outlet type — refused while outlets are still assigned' })
  @ApiResponse({ status: 200, description: 'Outlet type deleted' })
  async remove(@Param('id') id: string) {
    const data = await this.outletTypesService.remove(id);
    return { message: `Outlet type "${data.name}" deleted`, data };
  }
}
