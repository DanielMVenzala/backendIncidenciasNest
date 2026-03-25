import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
  UseGuards,
  SetMetadata,
  Res,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { FindUsersQueryDto } from 'src/common/dtos/find-users-query.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { AuthGuard } from '@nestjs/passport';

import { UserRoleGuard } from './guards/user-role/user-role.guard';
import { RoleProtected } from './decorators/role-protected/role-protected.decorator';
import { ValidRoles } from './interfaces/valid-roles';
import { ReportsService } from 'src/reports/reports.service';
import type { Response } from 'express';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from './entities/user.entity';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly reportsService: ReportsService,
  ) {}

  @ApiResponse({
    status: 201,
    description: 'User was created',
    type: User,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @Post('register')
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @ApiResponse({
    status: 201,
    description: 'Login successfully',
    type: User,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Post('login')
  login(@Body() loginUserDto: LoginUserDto) {
    return this.usersService.login(loginUserDto);
  }

  @Get('activate/:token')
  @ApiResponse({ status: 200, description: 'Account activated' })
  @ApiResponse({ status: 400, description: 'Invalid token' })
  async activateAccount(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    const result = await this.usersService.activateAccount(token);
    // Devolver HTML para que el usuario vea confirmación en el navegador
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <html>
        <head><meta charset="utf-8"><title>Cuenta activada</title></head>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #FAF7F2;">
          <div style="text-align: center; background: white; padding: 40px; border-radius: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
            <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
            <h2 style="color: #2C5F7C; margin: 0 0 8px;">¡Cuenta activada!</h2>
            <p style="color: #6B6B6B;">Ya puedes iniciar sesión en la app.</p>
          </div>
        </body>
      </html>
    `);
  }

  @Patch(':id/toggle-block')
  @ApiResponse({ status: 200, description: 'User blocked/unblocked' })
  @RoleProtected(ValidRoles.admin)
  @UseGuards(AuthGuard(), UserRoleGuard)
  toggleBlock(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.toggleBlock(id);
  }

  @Delete(':id')
  @SetMetadata('rol', 'admin')
  @RoleProtected(ValidRoles.admin)
  @UseGuards(AuthGuard(), UserRoleGuard)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }

  @Get()
  findAll(@Query() findUsersQueryDto: FindUsersQueryDto) {
    return this.usersService.findAll(findUsersQueryDto);
  }

  @ApiResponse({
    status: 200,
    description: 'User found',
    type: User,
  })
  @ApiResponse({ status: 500, description: 'User not found' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Get('report/excel')
  @UseGuards(AuthGuard())
  async downloadUsersReport(
    @Query() query: FindUsersQueryDto,
    @Res() res: Response,
  ) {
    //Obtenemos los usuarios con un límite mayor para el informe
    const users = await this.usersService.findAllEntities({
      ...query,
      limit: 1000,
    });

    const buffer = await this.reportsService.generateUsersExcel(users);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=informe_usuarios.xlsx',
    );

    res.send(buffer);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }
}
