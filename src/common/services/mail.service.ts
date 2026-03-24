import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private resend: Resend;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  async sendActivationEmail(to: string, nombre: string, token: string) {
    const activationUrl = `${process.env.HOST_API || 'http://localhost:3000/api/v1'}/users/activate/${token}`;

    await this.resend.emails.send({
      from: 'Incidencias Martos <onboarding@resend.dev>',
      to,
      subject: 'Activa tu cuenta — Incidencias Martos',
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #FAF7F2; border-radius: 16px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #2C5F7C, #4A8BAD); padding: 32px 24px; text-align: center;">
            <h1 style="color: #fff; margin: 0; font-size: 22px;">Incidencias Martos</h1>
          </div>
          <div style="padding: 32px 24px;">
            <p style="font-size: 16px; color: #1A1A1A;">Hola <strong>${nombre}</strong>,</p>
            <p style="font-size: 15px; color: #6B6B6B; line-height: 1.6;">
              Gracias por registrarte. Para activar tu cuenta, pulsa el siguiente botón:
            </p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${activationUrl}"
                 style="background: #2C5F7C; color: #fff; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">
                Activar mi cuenta
              </a>
            </div>
            <p style="font-size: 13px; color: #9E9E9E; line-height: 1.5;">
              Si no has creado esta cuenta, ignora este correo.
            </p>
          </div>
          <div style="background: #F0EDE6; padding: 16px 24px; text-align: center;">
            <p style="font-size: 12px; color: #9E9E9E; margin: 0;">Ayuntamiento de Martos — Plataforma de incidencias</p>
          </div>
        </div>
      `,
    });
  }
}
