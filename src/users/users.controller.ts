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
import { ForgotPasswordDto } from './dto/forgot-password.dto';
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

  // ─── Reset de contraseña ─────────────────────────────────

  @Post('forgot-password')
  @ApiResponse({ status: 200, description: 'Reset email sent (if email exists)' })
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.usersService.forgotPassword(forgotPasswordDto.email);
  }

  // Página HTML con formulario para introducir la nueva contraseña
  @Get('reset-password/:token')
  showResetForm(@Param('token') token: string, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <html>
        <head><meta charset="utf-8"><title>Restablecer contraseña</title></head>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #FAF7F2;">
          <div style="background: white; padding: 40px; border-radius: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); max-width: 380px; width: 90%;">
            <h2 style="color: #2C5F7C; margin: 0 0 8px; text-align: center;">Restablecer contraseña</h2>
            <p style="color: #6B6B6B; text-align: center; margin: 0 0 24px; font-size: 14px;">Introduce tu nueva contraseña</p>
            <form method="POST" action="/api/v1/users/reset-password/${token}">
              <input type="password" name="clave" placeholder="Nueva contraseña" required minlength="8"
                style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 10px; margin-bottom: 12px; font-size: 14px; box-sizing: border-box;" />
              <input type="password" name="confirmar" placeholder="Confirmar contraseña" required minlength="8"
                style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 10px; margin-bottom: 16px; font-size: 14px; box-sizing: border-box;" />
              <button type="submit"
                style="width: 100%; background: #2C5F7C; color: white; padding: 14px; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer;">
                Cambiar contraseña
              </button>
            </form>
          </div>
        </body>
      </html>
    `);
  }

  @Post('reset-password/:token')
  async processReset(
    @Param('token') token: string,
    @Body() body: { clave: string; confirmar: string },
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/html');

    if (!body.clave || body.clave.length < 8) {
      return res.send(this.renderResetMessage('error', 'La contraseña debe tener al menos 8 caracteres.'));
    }
    if (body.clave !== body.confirmar) {
      return res.send(this.renderResetMessage('error', 'Las contraseñas no coinciden.'));
    }

    try {
      await this.usersService.resetPassword(token, body.clave);
      return res.send(this.renderResetMessage('success', '¡Contraseña actualizada! Ya puedes iniciar sesión en la app.'));
    } catch (error: any) {
      return res.send(this.renderResetMessage('error', error.message || 'Error al cambiar la contraseña.'));
    }
  }

  private renderResetMessage(type: 'success' | 'error', message: string): string {
    const color = type === 'success' ? '#2C5F7C' : '#E53935';
    const icon = type === 'success' ? '✅' : '❌';
    return `
      <html>
        <head><meta charset="utf-8"><title>Restablecer contraseña</title></head>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #FAF7F2;">
          <div style="text-align: center; background: white; padding: 40px; border-radius: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); max-width: 380px;">
            <div style="font-size: 48px; margin-bottom: 16px;">${icon}</div>
            <h2 style="color: ${color}; margin: 0 0 8px;">${type === 'success' ? '¡Listo!' : 'Error'}</h2>
            <p style="color: #6B6B6B; margin: 0;">${message}</p>
          </div>
        </body>
      </html>
    `;
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
  @RoleProtected(ValidRoles.admin)
  @UseGuards(AuthGuard(), UserRoleGuard)
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
