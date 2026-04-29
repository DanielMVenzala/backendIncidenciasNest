import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Incident } from '../incidents/entities/incident.entity';
import { User } from 'src/users/entities/user.entity';

@Injectable()
export class ReportsService {
  //Generar reporte de incidentes con resumen ejecutivo + listado completo
  async generateIncidentsExcel(incidents: Incident[]) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Martos Arregla';
    workbook.created = new Date();

    // ─── HOJA 1: RESUMEN EJECUTIVO ─────────────────────────────
    const resumen = workbook.addWorksheet('Resumen ejecutivo');
    resumen.columns = [
      { header: 'Métrica', key: 'metrica', width: 35 },
      { header: 'Valor', key: 'valor', width: 20 },
    ];

    // Cálculo de métricas
    const total = incidents.length;
    const pendientes = incidents.filter((i) => i.estado === 'pendiente').length;
    const enProgreso = incidents.filter((i) => i.estado === 'en progreso').length;
    const resueltas = incidents.filter((i) => i.estado === 'resuelto').length;
    const rechazadas = incidents.filter((i) => i.estado === 'rechazada').length;

    const criticas = incidents.filter((i) => i.prioridad === 'critica').length;
    const altas = incidents.filter((i) => i.prioridad === 'alta').length;
    const medias = incidents.filter((i) => i.prioridad === 'media').length;
    const bajas = incidents.filter((i) => i.prioridad === 'baja').length;

    // Tiempo medio de resolución (en días)
    const resueltasConTiempo = incidents.filter(
      (i) => i.estado === 'resuelto' && i.creadoEn && i.actualizadoEn,
    );
    const tiempoMedioMs =
      resueltasConTiempo.length > 0
        ? resueltasConTiempo.reduce(
            (sum, i) =>
              sum +
              (new Date(i.actualizadoEn).getTime() - new Date(i.creadoEn).getTime()),
            0,
          ) / resueltasConTiempo.length
        : 0;
    const tiempoMedioDias = (tiempoMedioMs / (1000 * 60 * 60 * 24)).toFixed(1);

    // Top 5 usuarios con más incidencias
    const conteoUsuarios = new Map<string, number>();
    incidents.forEach((i) => {
      const nombre = i.usuario?.nombre || 'Anónimo';
      conteoUsuarios.set(nombre, (conteoUsuarios.get(nombre) || 0) + 1);
    });
    const topUsuarios = [...conteoUsuarios.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Añadir filas
    resumen.addRow({ metrica: 'INFORME GENERADO', valor: new Date().toLocaleString('es-ES') });
    resumen.addRow({});
    resumen.addRow({ metrica: '── TOTALES ──' });
    resumen.addRow({ metrica: 'Total de incidencias', valor: total });
    resumen.addRow({});
    resumen.addRow({ metrica: '── POR ESTADO ──' });
    resumen.addRow({ metrica: 'Pendientes', valor: pendientes });
    resumen.addRow({ metrica: 'En progreso', valor: enProgreso });
    resumen.addRow({ metrica: 'Resueltas', valor: resueltas });
    resumen.addRow({ metrica: 'Rechazadas', valor: rechazadas });
    resumen.addRow({});
    resumen.addRow({ metrica: '── POR PRIORIDAD ──' });
    resumen.addRow({ metrica: 'Críticas', valor: criticas });
    resumen.addRow({ metrica: 'Altas', valor: altas });
    resumen.addRow({ metrica: 'Medias', valor: medias });
    resumen.addRow({ metrica: 'Bajas', valor: bajas });
    resumen.addRow({});
    resumen.addRow({ metrica: '── EFICIENCIA ──' });
    resumen.addRow({
      metrica: 'Tiempo medio de resolución (días)',
      valor: tiempoMedioDias,
    });
    resumen.addRow({
      metrica: 'Porcentaje resuelto',
      valor: total > 0 ? `${((resueltas / total) * 100).toFixed(1)}%` : '0%',
    });
    resumen.addRow({});
    resumen.addRow({ metrica: '── TOP 5 USUARIOS ──' });
    topUsuarios.forEach(([nombre, count], idx) => {
      resumen.addRow({ metrica: `${idx + 1}. ${nombre}`, valor: `${count} incidencias` });
    });

    // Estilos del resumen
    resumen.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2C5F7C' },
      };
    });
    resumen.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const firstCell = row.getCell(1);
      const text = firstCell.value?.toString() || '';
      if (text.startsWith('──')) {
        firstCell.font = { bold: true, color: { argb: 'FF2C5F7C' } };
      }
    });

    // ─── HOJA 2: LISTADO COMPLETO ──────────────────────────────
    const listado = workbook.addWorksheet('Listado completo');
    listado.columns = [
      { header: 'ID', key: 'id', width: 38 },
      { header: 'Título', key: 'titulo', width: 30 },
      { header: 'Descripción', key: 'descripcion', width: 50 },
      { header: 'Dirección', key: 'direccion', width: 40 },
      { header: 'Estado', key: 'estado', width: 14 },
      { header: 'Prioridad', key: 'prioridad', width: 12 },
      { header: 'Usuario', key: 'usuario', width: 25 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Nº imágenes', key: 'numImagenes', width: 12 },
      { header: 'Nº comentarios', key: 'numComentarios', width: 14 },
      { header: 'Latitud', key: 'latitud', width: 12 },
      { header: 'Longitud', key: 'longitud', width: 12 },
      { header: 'Creada', key: 'creadoEn', width: 20 },
      { header: 'Actualizada', key: 'actualizadoEn', width: 20 },
    ];

    incidents.forEach((incident) => {
      listado.addRow({
        id: incident.id,
        titulo: incident.titulo,
        descripcion: incident.descripcion,
        direccion: incident.direccion,
        estado: incident.estado,
        prioridad: incident.prioridad,
        usuario: incident.usuario?.nombre || 'Anónimo',
        email: incident.usuario?.email || '-',
        numImagenes: incident.imagenes?.length || 0,
        numComentarios: incident.comentarios?.length || 0,
        latitud: incident.latitud ?? '-',
        longitud: incident.longitud ?? '-',
        creadoEn: incident.creadoEn?.toLocaleString('es-ES') || '-',
        actualizadoEn: incident.actualizadoEn?.toLocaleString('es-ES') || '-',
      });
    });

    // Cabecera con estilo
    listado.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2C5F7C' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Filtros automáticos en la cabecera
    listado.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 14 },
    };
    listado.views = [{ state: 'frozen', ySplit: 1 }];

    return await workbook.xlsx.writeBuffer();
  }

  //Generar reporte de usuarios
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
