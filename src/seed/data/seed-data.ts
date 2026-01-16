interface SeedIncident {
  titulo: string;
  descripcion: string;
  direccion: string;
  imagenes: string[];
  usuario: string;
}

interface SeedUser {
  nombre: string;
  email: string;
  clave: string;
}

interface SeedData {
  incidents: SeedIncident[];
  users: SeedUser[];
}

export const initialData: SeedData = {
  users: [
    {
      nombre: 'Alejandro García Martínez',
      email: 'a.garcia@email.com',
      clave: 'Garc1a_2024!',
    },
    {
      nombre: 'Valentina Rodríguez Silva',
      email: 'v.rodriguez@servidor.es',
      clave: 'Valen_Rod92',
    },
    {
      nombre: 'Mateo Hernández López',
      email: 'm.hernandez@webmail.com',
      clave: 'MateoH_#88',
    },
    {
      nombre: 'Isabella Torres Castro',
      email: 'isabella.torres@corporativo.com',
      clave: 'T0rres_I@2023',
    },
    {
      nombre: 'Sebastián Ramírez Peña',
      email: 's.ramirez@fastmail.net',
      clave: 'Ramz_Sebas_55',
    },
    {
      nombre: 'Lucía Méndez Morales',
      email: 'lucia.mendez@u-portal.com',
      clave: 'LM_Morales!8',
    },
    {
      nombre: 'Julián Ortega Vargas',
      email: 'j.ortega@digital.org',
      clave: 'Jortega_90_v',
    },
    {
      nombre: 'Mariana Flores Solís',
      email: 'm.flores@servicios.mx',
      clave: 'Flor3s_Mariana',
    },
    {
      nombre: 'Nicolás Ruiz Salazar',
      email: 'n.ruiz@tecnologia.io',
      clave: 'NRuiz_9172',
    },
    {
      nombre: 'Camila Soto Herrera',
      email: 'c.soto@dominio.com',
      clave: 'Soto_C_2024',
    },
    {
      nombre: 'Diego Navarro Jiménez',
      email: 'd.navarro@consultora.com',
      clave: 'DiegoNav_88*',
    },
    {
      nombre: 'Sofía Paredes Rivas',
      email: 's.paredes@red.com',
      clave: 'Paredes_Sof_!',
    },
    {
      nombre: 'Joaquín Valdez Espinoza',
      email: 'j.valdez@empresa.cl',
      clave: 'ValdezJ_3312',
    },
    {
      nombre: 'Elena Castillo Duarte',
      email: 'e.castillo@mail.com',
      clave: 'Elena_CD_#00',
    },
    {
      nombre: 'Andrés Ibarra Santos',
      email: 'a.ibarra@proyectos.net',
      clave: 'Ibarra_A_2024',
    },
    {
      nombre: 'Daniela Acosta Benítez',
      email: 'd.acosta@asistente.com',
      clave: 'Dacosta_Ben22',
    },
    {
      nombre: 'Felipe Guerrero Campos',
      email: 'f.guerrero@estudio.com',
      clave: 'Gue_Fel_2021',
    },
    {
      nombre: 'Martina Suárez Pardo',
      email: 'm.suarez@web.es',
      clave: 'Marti_Sua_77',
    },
    {
      nombre: 'Gabriel Montero Ríos',
      email: 'g.montero@nube.com',
      clave: 'Montero_G_#24',
    },
    {
      nombre: 'Victoria Rojas Beltrán',
      email: 'v.rojas@global.com',
      clave: 'Vic_Rojas_91',
    },
  ],

  incidents: [
    {
      titulo: 'Contenedor desbordado',
      descripcion:
        'El contenedor de residuos orgánicos lleva varios días sin recogerse y los restos están en la acera.',
      direccion: 'Plaza de la Constitución, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882548/martos_incidents/file_eovlwz.jpg',
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882538/martos_incidents/file_rnsdpr.jpg',
      ],
      usuario: 'a.garcia@email.com',
    },
    {
      titulo: 'Farola sin luz',
      descripcion:
        'La farola situada junto al paso de peatones no funciona por la noche.',
      direccion: 'Avenida Moris Marrodán, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882532/martos_incidents/file_o8achf.jpg',
      ],
      usuario: 'v.rodriguez@servidor.es',
    },
    {
      titulo: 'Bache profundo',
      descripcion:
        'Existe un bache de gran tamaño que dificulta la circulación de vehículos.',
      direccion: 'Calle Real, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882523/martos_incidents/file_y6hjda.jpg',
      ],
      usuario: 'm.hernandez@webmail.com',
    },
    {
      titulo: 'Señal doblada',
      descripcion: 'La señal de stop está inclinada y apenas se distingue.',
      direccion: 'Calle Campiña, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882510/martos_incidents/file_egcjhb.jpg',
      ],
      usuario: 'isabella.torres@corporativo.com',
    },
    {
      titulo: 'Fuga de agua',
      descripcion:
        'Se observa salida continua de agua limpia desde la arqueta.',
      direccion: 'Calle Príncipe Felipe, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882498/martos_incidents/file_nguolh.jpg',
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882491/martos_incidents/file_oxqy21.jpg',
      ],
      usuario: 's.ramirez@fastmail.net',
    },
    {
      titulo: 'Pintadas vandálicas',
      descripcion:
        'La fachada del edificio público ha aparecido con grafitis ofensivos.',
      direccion: 'Estación de Autobuses, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882483/martos_incidents/file_x6pwhf.jpg',
      ],
      usuario: 'lucia.mendez@u-portal.com',
    },
    {
      titulo: 'Semáforo averiado',
      descripcion: 'El semáforo permanece en ámbar intermitente todo el día.',
      direccion: 'Cruce Avenida Europa con Moris Marrodán, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882475/martos_incidents/file_j4qivg.jpg',
      ],
      usuario: 'j.ortega@digital.org',
    },
    {
      titulo: 'Banco roto',
      descripcion:
        'Uno de los bancos del parque tiene varias tablas rotas y es peligroso sentarse.',
      direccion: 'Parque Manuel Carrasco, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882448/martos_incidents/file_db4qti.jpg',
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882548/martos_incidents/file_eovlwz.jpg',
      ],
      usuario: 'm.flores@servicios.mx',
    },
    {
      titulo: 'Alcorque sin árbol',
      descripcion: 'El alcorque está vacío y supone riesgo de tropiezos.',
      direccion: 'Calle San Amador, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882538/martos_incidents/file_rnsdpr.jpg',
      ],
      usuario: 'n.ruiz@tecnologia.io',
    },
    {
      titulo: 'Papeleras arrancadas',
      descripcion: 'Dos papeleras han sido arrancadas de su base.',
      direccion: 'Parque Manuel Carrasco, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882532/martos_incidents/file_o8achf.jpg',
      ],
      usuario: 'c.soto@dominio.com',
    },
    {
      titulo: 'Cableado al descubierto',
      descripcion:
        'Hay cables eléctricos visibles tras romperse la tapa protectora.',
      direccion: 'Calle La Teja, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882523/martos_incidents/file_y6hjda.jpg',
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882510/martos_incidents/file_egcjhb.jpg',
      ],
      usuario: 'd.navarro@consultora.com',
    },
    {
      titulo: 'Acera levantada',
      descripcion: 'Las losetas de la acera están levantadas por raíces.',
      direccion: 'Calle Huertas, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882498/martos_incidents/file_nguolh.jpg',
      ],
      usuario: 's.paredes@red.com',
    },
    {
      titulo: 'Vehículo abandonado',
      descripcion:
        'El coche lleva meses estacionado y presenta ruedas pinchadas.',
      direccion: 'Calle Carrera, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882491/martos_incidents/file_oxqy21.jpg',
      ],
      usuario: 'j.valdez@empresa.cl',
    },
    {
      titulo: 'Barandilla oxidada',
      descripcion: 'La barandilla del mirador tiene óxido y partes cortantes.',
      direccion: 'Mirador de la Peña, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882483/martos_incidents/file_x6pwhf.jpg',
      ],
      usuario: 'e.castillo@mail.com',
    },
    {
      titulo: 'Fuente sin agua',
      descripcion: 'La fuente ornamental está seca y sucia.',
      direccion: 'Parque Manuel Carrasco, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882475/martos_incidents/file_j4qivg.jpg',
      ],
      usuario: 'a.ibarra@proyectos.net',
    },
    {
      titulo: 'Tapa de alcantarilla rota',
      descripcion: 'La tapa está fracturada y se mueve al pisar.',
      direccion: 'Calle Triana, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882448/martos_incidents/file_db4qti.jpg',
      ],
      usuario: 'd.acosta@asistente.com',
    },
    {
      titulo: 'Mal olor persistente',
      descripcion: 'Olor a aguas fecales en toda la zona.',
      direccion: 'Calle Adarves, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882548/martos_incidents/file_eovlwz.jpg',
      ],
      usuario: 'f.guerrero@estudio.com',
    },
    {
      titulo: 'Parque infantil deteriorado',
      descripcion: 'El tobogán tiene grietas y tornillos salientes.',
      direccion: 'Parque Manuel Carrasco, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882538/martos_incidents/file_rnsdpr.jpg',
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882532/martos_incidents/file_o8achf.jpg',
      ],
      usuario: 'm.suarez@web.es',
    },
    {
      titulo: 'Paso de cebra borrado',
      descripcion: 'La pintura del paso de peatones casi ha desaparecido.',
      direccion: 'Avenida Europa, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882523/martos_incidents/file_y6hjda.jpg',
      ],
      usuario: 'g.montero@nube.com',
    },
    {
      titulo: 'Obras sin señalizar',
      descripcion: 'Hay zanjas abiertas sin vallas de protección.',
      direccion: 'Calle Lope de Vega, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882510/martos_incidents/file_egcjhb.jpg',
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882498/martos_incidents/file_nguolh.jpg',
      ],
      usuario: 'v.rojas@global.com',
    },
    {
      titulo: 'Perros sueltos',
      descripcion: 'Se observan perros grandes sueltos por la noche.',
      direccion: 'Calle Almedina, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882491/martos_incidents/file_oxqy21.jpg',
      ],
      usuario: 'a.garcia@email.com',
    },
    {
      titulo: 'Cristales en la vía',
      descripcion: 'Restos de botellas rotas sobre la calzada.',
      direccion: 'Calle La Villa, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882483/martos_incidents/file_x6pwhf.jpg',
      ],
      usuario: 'v.rodriguez@servidor.es',
    },
    {
      titulo: 'Plaga de palomas',
      descripcion: 'Gran concentración de palomas con excrementos en cornisas.',
      direccion: 'Iglesia de Santa Marta, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882475/martos_incidents/file_j4qivg.jpg',
      ],
      usuario: 'm.hernandez@webmail.com',
    },
    {
      titulo: 'Aparcamiento ilegal',
      descripcion: 'Los vehículos invaden continuamente la zona peatonal.',
      direccion: 'Plaza Fuente Nueva, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882448/martos_incidents/file_db4qti.jpg',
      ],
      usuario: 'isabella.torres@corporativo.com',
    },
    {
      titulo: 'Mobiliario quemado',
      descripcion: 'Un banco y una papelera presentan signos de incendio.',
      direccion: 'Calle Teniente General Chamorro Martínez, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882548/martos_incidents/file_eovlwz.jpg',
      ],
      usuario: 's.ramirez@fastmail.net',
    },
    {
      titulo: 'Rotura de muro',
      descripcion: 'Parte del muro de contención se ha desprendido.',
      direccion: 'Calle Adarves Bajos, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882538/martos_incidents/file_rnsdpr.jpg',
      ],
      usuario: 'lucia.mendez@u-portal.com',
    },
    {
      titulo: 'Rama a punto de caer',
      descripcion: 'Una rama grande está partida y podría caer con viento.',
      direccion: 'Parque Manuel Carrasco, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882532/martos_incidents/file_o8achf.jpg',
      ],
      usuario: 'j.ortega@digital.org',
    },
    {
      titulo: 'Falta de limpieza',
      descripcion: 'Acumulación de hojas y suciedad en toda la calle.',
      direccion: 'Calle Dolores Torres, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882523/martos_incidents/file_y6hjda.jpg',
      ],
      usuario: 'm.flores@servicios.mx',
    },
    {
      titulo: 'Escalones resbaladizos',
      descripcion: 'Los escalones están pulidos y provocan caídas.',
      direccion: 'Calle Adarves, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882510/martos_incidents/file_egcjhb.jpg',
      ],
      usuario: 'n.ruiz@tecnologia.io',
    },
    {
      titulo: 'Valla caída',
      descripcion: 'La valla metálica del polideportivo está en el suelo.',
      direccion: 'Polideportivo Municipal, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882498/martos_incidents/file_nguolh.jpg',
      ],
      usuario: 'c.soto@dominio.com',
    },
    {
      titulo: 'Vertido de aceite',
      descripcion: 'Se ha vertido aceite de cocina en la calzada.',
      direccion: 'Calle Motril, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882491/martos_incidents/file_oxqy21.jpg',
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882483/martos_incidents/file_x6pwhf.jpg',
      ],
      usuario: 'd.navarro@consultora.com',
    },
    {
      titulo: 'Rotura de marquesina',
      descripcion: 'El cristal de la marquesina de autobús está roto.',
      direccion: 'Avenida Moris Marrodán, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882475/martos_incidents/file_j4qivg.jpg',
      ],
      usuario: 's.paredes@red.com',
    },
    {
      titulo: 'Extintor desaparecido',
      descripcion: 'En el edificio público falta el extintor reglamentario.',
      direccion: 'Casa de la Juventud, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882448/martos_incidents/file_db4qti.jpg',
      ],
      usuario: 'j.valdez@empresa.cl',
    },
    {
      titulo: 'Pavimento hundido',
      descripcion: 'El pavimento se ha hundido alrededor de una arqueta.',
      direccion: 'Calle Torredonjimeno, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882548/martos_incidents/file_eovlwz.jpg',
      ],
      usuario: 'e.castillo@mail.com',
    },
    {
      titulo: 'Rotura de tubería riego',
      descripcion: 'La tubería del sistema de riego pierde agua continuamente.',
      direccion: 'Parque del Lagartijo, Martos',
      imagenes: [
        'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882538/martos_incidents/file_rnsdpr.jpg',
      ],
      usuario: 'a.ibarra@proyectos.net',
    },
  ],
};
