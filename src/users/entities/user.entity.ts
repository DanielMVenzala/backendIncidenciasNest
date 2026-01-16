import { ApiProperty } from '@nestjs/swagger';
import * as bcrypt from 'bcrypt';
import { Incident } from 'src/incidents/entities/incident.entity';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  USUARIO = 'usuario',
  ADMIN = 'admin',
}

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    example: 'Isabella Torres Castro',
    description: 'User name',
  })
  @Column('text')
  nombre: string;

  @ApiProperty({
    example: 'isabella.torres@corporativo.com',
    description: 'User email',
    uniqueItems: true,
  })
  @Column('text', {
    unique: true,
  })
  email: string;

  @ApiProperty({
    example: 'asd234_sKJSLJ24',
    description: 'User password',
  })
  @Column('text', {
    //Cuando se haga una búsqueda no muestre la contraseña
    select: false,
  })
  clave: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USUARIO,
  })
  rol: UserRole;

  @Column('bool', {
    default: true,
  })
  activo: boolean;

  @OneToMany(() => Incident, (incident) => incident.usuario, {
    cascade: false,
  })
  incidentes?: Incident[];

  @CreateDateColumn({
    type: 'timestamp with time zone',
  })
  creadoEn: Date;

  @UpdateDateColumn({
    type: 'timestamp with time zone',
  })
  actualizadoEn: Date;

  //Para hashear el password si se crea o si se actualiza
  //Se procesa 10 veces para más seguridad (SALT ROUNDS)
  @BeforeInsert()
  async hashPasswordBeforeInsert() {
    this.clave = await bcrypt.hash(
      this.clave,
      +process.env.BCRYPT_SALT_ROUNDS!,
    );
  }

  @BeforeInsert()
  checkFieldsBeforeInsert() {
    this.email = this.email.toLowerCase().trim();
  }

  @BeforeUpdate()
  checkFieldsBeforeUpdate() {
    this.checkFieldsBeforeInsert();
  }

  @BeforeUpdate()
  async hashPasswordBeforeUpdate() {
    //Si empeza por $2b$ es que ya está hasheado, por lo que no hay que hacerlo de nuevo
    if (this.clave && !this.clave.startsWith('$2b$')) {
      await bcrypt.hash(this.clave, +process.env.BCRYPT_SALT_ROUNDS!);
    }
  }
}
