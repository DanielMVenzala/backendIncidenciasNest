import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Incident } from '../incidents/entities/incident.entity';
import { User } from 'src/users/entities/user.entity';

@Injectable()
export class ReportsService {
  //Recibimos el array de incidentes
  async generateIncidentsExcel(incidents: Incident[]) {
    //Workbook es el propio archivo de excel
    const workbook = new ExcelJS.Workbook();
    //Las diferentes pestañas que se crea en la parte inferior de un documento excel
    const worksheet = workbook.addWorksheet('Incidentes Martos');

    //Definir las columnas
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Título', key: 'titulo', width: 30 },
      { header: 'Descripción', key: 'descripcion', width: 50 },
      { header: 'Dirección', key: 'direccion', width: 50 },
      { header: 'Usuario', key: 'usuarioId', width: 25 },
      { header: 'Estado', key: 'estado', width: 25 },
      { header: 'Prioridad', key: 'prioridad', width: 25 },
      { header: 'Fecha de Creación', key: 'creadoEn', width: 20 },
      { header: 'Fecha de Actualización', key: 'actualizadoEn', width: 20 },
      { header: 'Imágenes', key: 'imagenes', width: 50 },
    ];

    //Añadir las filas
    incidents.forEach((incident) => {
      worksheet.addRow({
        id: incident.id,
        titulo: incident.titulo,
        descripcion: incident.descripcion,
        direccion: incident.direccion,
        usuario: incident.usuario?.id || 'Anónimo',
        estado: incident.estado,
        prioridad: incident.prioridad,
        creadoEn: incident.creadoEn.toLocaleString(),
        actualizadoEn: incident.actualizadoEn.toLocaleString(),
        imagenes: (incident.imagenes || []).map((img) => img.url).join(', '),
      });
    });

    worksheet.getRow(1).font = { bold: true };

    //Escribir en un buffer (memoria)
    return await workbook.xlsx.writeBuffer();
  }

  async generateUsersExcel(users: User[]) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Usuarios Registrados');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 30 },
      { header: 'Nombre Completo', key: 'nombre', width: 25 },
      { header: 'Correo Electrónico', key: 'email', width: 30 },
      { header: 'Rol', key: 'rol', width: 15 },
      { header: 'Total Incidentes', key: 'totalIncidentes', width: 15 },
    ];

    users.forEach((user) => {
      worksheet.addRow({
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        totalIncidentes: user.incidentes?.length || 0,
      });
    });

    //Estilo para la cabecera
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2E75B6' },
      };
    });

    return await workbook.xlsx.writeBuffer();
  }
}
