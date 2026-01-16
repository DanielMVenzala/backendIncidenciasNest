import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  SetMetadata,
  UseGuards,
  Res,
} from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { FindIncidentsQueryDto } from 'src/common/dtos/find-incidents-query.dto';
import { RoleProtected } from 'src/users/decorators/role-protected/role-protected.decorator';
import { ValidRoles } from 'src/users/interfaces/valid-roles';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from 'src/users/guards/user-role/user-role.guard';
import { ReportsService } from 'src/reports/reports.service';
import express from 'express';
import type { Response } from 'express';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { Incident } from './entities/incident.entity';

@ApiTags('Incidents')
@Controller('incidents')
export class IncidentsController {
  constructor(
    private readonly incidentsService: IncidentsService,
    private readonly reportsService: ReportsService,
  ) {}

  @Post()
  @ApiResponse({
    status: 201,
    description: 'Incident was created',
    type: Incident,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  create(@Body() createIncidentDto: CreateIncidentDto) {
    return this.incidentsService.create(createIncidentDto);
  }

  @Get()
  //Se le pasa el DTO con los posibles querys
  findAll(@Query() findIncidentsDto: FindIncidentsQueryDto) {
    return this.incidentsService.findAll(findIncidentsDto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.incidentsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateIncidentDto: UpdateIncidentDto,
  ) {
    return this.incidentsService.update(id, updateIncidentDto);
  }

  @Delete(':id')
  @SetMetadata('rol', 'admin')
  @RoleProtected(ValidRoles.admin)
  @UseGuards(AuthGuard(), UserRoleGuard)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.incidentsService.remove(id);
  }

  @Get('report/excel')
  @SetMetadata('rol', 'admin')
  @RoleProtected(ValidRoles.admin)
  @UseGuards(AuthGuard(), UserRoleGuard)
  async downloadReport(
    @Query() query: FindIncidentsQueryDto,
    @Res() res: Response,
  ) {
    // Llamamos al método que NO formatea
    const incidents = await this.incidentsService.findAllEntities({
      ...query,
      limit: 1000, // Aumentamos el límite para el reporte
    });

    const buffer = await this.reportsService.generateIncidentsExcel(incidents);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename=reporte.xlsx');
    res.send(buffer);
  }
}
