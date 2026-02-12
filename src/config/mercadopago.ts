import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import { logger } from '../utils/logger';

/**
 * Configuración del SDK de MercadoPago
 */
class MercadoPagoConfiguration {
  private client: MercadoPagoConfig;
  private preference: Preference;
  private payment: Payment;
  private accessToken: string;
  private publicKey: string;

  constructor() {
    this.accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
    this.publicKey = process.env.MERCADOPAGO_PUBLIC_KEY || '';

    if (!this.accessToken) {
      throw new Error('MERCADOPAGO_ACCESS_TOKEN no está configurado en las variables de entorno');
    }

    if (!this.publicKey) {
      throw new Error('MERCADOPAGO_PUBLIC_KEY no está configurado en las variables de entorno');
    }

    // Validar que los tokens tengan el formato correcto
    if (!this.isValidToken(this.accessToken)) {
      throw new Error('MERCADOPAGO_ACCESS_TOKEN tiene un formato inválido');
    }

    try {
      // Inicializar cliente de MercadoPago
      this.client = new MercadoPagoConfig({
        accessToken: this.accessToken,
        options: {
          timeout: 5000
        }
      });

      // Inicializar servicios
      this.preference = new Preference(this.client);
      this.payment = new Payment(this.client);

      logger.info('MercadoPago configurado exitosamente', {
        environment: this.getEnvironment(),
        publicKey: this.publicKey.substring(0, 20) + '...'
      });

    } catch (error) {
      logger.error('Error configurando MercadoPago:', error);
      throw new Error('Error en la configuración de MercadoPago');
    }
  }

  /**
   * Validar formato del token
   */
  private isValidToken(token: string): boolean {
    // Tokens de TEST deben comenzar con TEST-
    // Tokens de producción deben comenzar con APP-
    return token.startsWith('TEST-') || token.startsWith('APP-');
  }

  /**
   * Determinar el entorno basado en el token
   */
  public getEnvironment(): 'sandbox' | 'production' {
    return this.accessToken.startsWith('TEST-') ? 'sandbox' : 'production';
  }

  /**
   * Verificar si estamos en entorno de pruebas
   */
  public isSandbox(): boolean {
    return this.getEnvironment() === 'sandbox';
  }

  /**
   * Obtener instancia de Preference
   */
  public getPreferenceService(): Preference {
    return this.preference;
  }

  /**
   * Obtener instancia de Payment
   */
  public getPaymentService(): Payment {
    return this.payment;
  }

  /**
   * Obtener clave pública (para el frontend)
   */
  public getPublicKey(): string {
    return this.publicKey;
  }

  /**
   * Obtener URL del webhook configurada
   */
  public getWebhookUrl(): string {
    return process.env.MERCADOPAGO_WEBHOOK_URL || '';
  }

  /**
   * Validar configuración completa
   */
  public validateConfiguration(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.accessToken) {
      errors.push('MERCADOPAGO_ACCESS_TOKEN no configurado');
    }

    if (!this.publicKey) {
      errors.push('MERCADOPAGO_PUBLIC_KEY no configurado');
    }

    if (!this.getWebhookUrl()) {
      errors.push('MERCADOPAGO_WEBHOOK_URL no configurado');
    }

    if (!this.isValidToken(this.accessToken)) {
      errors.push('MERCADOPAGO_ACCESS_TOKEN tiene formato inválido');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Obtener información de configuración (sin datos sensibles)
   */
  public getConfigInfo() {
    return {
      environment: this.getEnvironment(),
      isSandbox: this.isSandbox(),
      publicKey: this.publicKey.substring(0, 20) + '...',
      webhookConfigured: !!this.getWebhookUrl(),
      accessTokenConfigured: !!this.accessToken
    };
  }
}

// Crear instancia singleton
let mercadoPagoConfig: MercadoPagoConfiguration;

/**
 * Obtener configuración de MercadoPago (Singleton)
 */
export const getMercadoPagoConfig = (): MercadoPagoConfiguration => {
  if (!mercadoPagoConfig) {
    mercadoPagoConfig = new MercadoPagoConfiguration();
  }
  return mercadoPagoConfig;
};

/**
 * Inicializar MercadoPago (para llamar al inicio de la aplicación)
 */
export const initializeMercadoPago = (): void => {
  try {
    const config = getMercadoPagoConfig();
    const validation = config.validateConfiguration();

    if (!validation.isValid) {
      logger.error('Configuración de MercadoPago inválida:', validation.errors);
      throw new Error(`Configuración inválida: ${validation.errors.join(', ')}`);
    }

    logger.info('MercadoPago inicializado correctamente', config.getConfigInfo());

  } catch (error) {
    logger.error('Error inicializando MercadoPago:', error);
    throw error;
  }
};

// Exportar tipos útiles para TypeScript
export type { MercadoPagoConfig, Preference, Payment };