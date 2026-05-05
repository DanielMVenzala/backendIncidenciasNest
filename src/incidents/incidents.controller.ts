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
import { CreateCommentDto } from './dto/create-comment.dto';
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
import { GeocodingService } from 'src/common/services/geocoding.service';

@ApiTags('Incidents')
@Controller('incidents')
export class IncidentsController {
  constructor(
    private readonly incidentsService: IncidentsService,
    private readonly reportsService: ReportsService,
    private readonly geocodingService: GeocodingService,
  ) {}

  // Autocompletado de direcciones — enrutado por el backend
  // para no exponer la API Key de Google Maps en el frontend
  @Get('places/autocomplete')
  @ApiResponse({ status: 200, description: 'Address suggestions' })
  autocomplete(@Query('input') input: string) {
    if (!input || input.length < 3) return [];
    return this.geocodingService.autocomplete(input);
  }

  @Post()
  @UseGuards(AuthGuard())
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
  @UseGuards(AuthGuard())
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateIncidentDto: UpdateIncidentDto,
  ) {
    return this.incidentsService.update(id, updateIncidentDto);
  }

  // ─── Comentarios ─────────────────────────────────────────

  @Post(':id/comments')
  @UseGuards(AuthGuard())
  @ApiResponse({ status: 201, description: 'Comment added' })
  addComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() createCommentDto: CreateCommentDto,
  ) {
    return this.incidentsService.addComment(id, createCommentDto);
  }

  @Get(':id/comments')
  getComments(@Param('id', ParseUUIDPipe) id: string) {
    return this.incidentsService.getComments(id);
  }

  @Delete(':id')
  @SetMetadata('rol', 'admin')
  @RoleProtected(ValidRoles.admin)
  @UseGuards(AuthGuard(), UserRoleGuard)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.incidentsService.remove(id);
  }

  //Método para generar un reporte en excel (hace falta ser admin)
  @Get('report/excel')
  @SetMetadata('rol', 'admin')
  @RoleProtected(ValidRoles.admin)
  @UseGuards(AuthGuard(), UserRoleGuard)
  async downloadReport(
    @Query() query: FindIncidentsQueryDto,
    @Res() res: Response,
  ) {
    //Llamamos al find que no formatea la data
    const incidents = await this.incidentsService.findAllEntities({
      ...query,
      limit: 1000,
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
