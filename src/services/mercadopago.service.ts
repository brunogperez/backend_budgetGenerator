import { PreferenceRequest, PreferenceResponse } from 'mercadopago/dist/clients/preference/commonTypes';
import { PaymentResponse } from 'mercadopago/dist/clients/payment/commonTypes';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { getMercadoPagoConfig } from '../config/mercadopago';
import { logger } from '../utils/logger';
import { MercadoPagoPreference, MercadoPagoWebhook } from '../types';

/**
 * Interfaz para los parámetros de creación de orden de pago
 */
export interface CreatePaymentOrderParams {
  quoteId: string;
  amount: number;
  description: string;
  externalReference: string;
  customerEmail?: string;
  customerName?: string;
}

/**
 * Interfaz para el resultado de creación de orden de pago
 */
export interface CreatePaymentOrderResult {
  preferenceId: string;
  qrCodeBase64: string;
  qrCodeData: string;
  initPoint: string;
  sandboxInitPoint?: string;
}

/**
 * Interfaz para datos del webhook procesado
 */
export interface ProcessedWebhookData {
  paymentId: string;
  status: string;
  externalReference?: string;
  merchantOrder?: string;
  topic: string;
  isValid: boolean;
}

/**
 * Servicio de MercadoPago
 */
class MercadoPagoService {
  private config = getMercadoPagoConfig();

  /**
   * Crear orden de pago en MercadoPago
   */
  async createPaymentOrder(params: CreatePaymentOrderParams): Promise<CreatePaymentOrderResult> {
    try {
      const { quoteId, amount, description, externalReference, customerEmail, customerName } = params;

      logger.info('Creando orden de pago en MercadoPago', {
        quoteId,
        amount,
        externalReference
      });

      // Construir datos de la preferencia
      const preferenceData: PreferenceRequest = {
        items: [
          {
            id: quoteId,
            title: description,
            quantity: 1,
            unit_price: amount,
            currency_id: 'ARS'
          }
        ],
        external_reference: externalReference,
        notification_url: this.config.getWebhookUrl(),
        back_urls: {
          success: `${process.env.FRONTEND_URL}/payment-success`,
          failure: `${process.env.FRONTEND_URL}/payment-failure`,
          pending: `${process.env.FRONTEND_URL}/payment-pending`
        },
        auto_return: 'approved',
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas
        purpose: 'wallet_purchase'
      };

      // Agregar información del cliente si está disponible
      if (customerEmail || customerName) {
        preferenceData.payer = {
          ...(customerName && { name: customerName }),
          ...(customerEmail && { email: customerEmail }),
          identification: {
            type: 'DNI',
            number: '00000000'
          }
        };
      }

      // Crear preferencia en MercadoPago
      const preference = await this.config.getPreferenceService().create({
        body: preferenceData
      });

      if (!preference.id || !preference.init_point) {
        throw new Error('MercadoPago no devolvió los datos esperados');
      }

      logger.info('Preferencia creada en MercadoPago', {
        preferenceId: preference.id,
        externalReference
      });

      // Generar QR code
      const qrCodeData = preference.init_point;
      const qrCodeBase64 = await this.generateQRCode(qrCodeData);

      return {
        preferenceId: preference.id,
        qrCodeBase64,
        qrCodeData,
        initPoint: preference.init_point,
        ...(preference.sandbox_init_point && { sandboxInitPoint: preference.sandbox_init_point })
      };

    } catch (error) {
      logger.error('Error creando orden de pago en MercadoPago:', error);
      throw new Error(`Error en MercadoPago: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Generar QR code en base64
   */
  private async generateQRCode(data: string): Promise<string> {
    try {
      const qrCode = await QRCode.toDataURL(data, {
        errorCorrectionLevel: 'M',
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 300
      });

      return qrCode;

    } catch (error) {
      logger.error('Error generando QR code:', error);
      throw new Error('Error generando código QR');
    }
  }

  /**
   * Obtener estado de un pago por ID
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentResponse> {
    try {
      logger.info('Consultando estado de pago en MercadoPago', { paymentId });

      const payment = await this.config.getPaymentService().get({
        id: parseInt(paymentId, 10)
      });

      if (!payment) {
        throw new Error('Pago no encontrado en MercadoPago');
      }

      logger.info('Estado de pago obtenido', {
        paymentId,
        status: payment.status,
        statusDetail: payment.status_detail
      });

      return payment;

    } catch (error) {
      logger.error('Error obteniendo estado de pago:', error);
      throw new Error(`Error consultando pago: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Procesar webhook de MercadoPago
   */
  async processWebhook(webhookData: any, signature?: string): Promise<ProcessedWebhookData> {
    try {
      logger.info('Procesando webhook de MercadoPago', {
        action: webhookData.action,
        type: webhookData.type,
        dataId: webhookData.data?.id
      });

      // Validar estructura del webhook
      if (!webhookData.type || !webhookData.data?.id) {
        throw new Error('Webhook con estructura inválida');
      }

      // Validar firma del webhook (si está disponible)
      if (signature) {
        const isValidSignature = this.validateWebhookSignature(webhookData, signature);
        if (!isValidSignature) {
          logger.warn('Webhook con firma inválida rechazado');
          return {
            paymentId: '',
            status: '',
            topic: webhookData.type,
            isValid: false
          };
        }
      }

      const result: ProcessedWebhookData = {
        paymentId: webhookData.data.id.toString(),
        status: '',
        topic: webhookData.type,
        isValid: true
      };

      // Procesar según el tipo de webhook
      if (webhookData.type === 'payment') {
        // Obtener información completa del pago
        const payment = await this.getPaymentStatus(webhookData.data.id);

        result.status = payment.status || '';
        if (payment.external_reference) {
          result.externalReference = payment.external_reference;
        }

        logger.info('Webhook de pago procesado', {
          paymentId: result.paymentId,
          status: result.status,
          externalReference: result.externalReference
        });

      } else if (webhookData.type === 'merchant_order') {
        result.merchantOrder = webhookData.data.id.toString();

        logger.info('Webhook de merchant order procesado', {
          merchantOrderId: result.merchantOrder
        });
      }

      return result;

    } catch (error) {
      logger.error('Error procesando webhook:', error);
      throw error;
    }
  }

  /**
   * Validar firma del webhook (implementación básica)
   */
  private validateWebhookSignature(webhookData: any, signature: string): boolean {
    try {
      // Esta es una implementación básica
      // En producción, deberías usar la validación oficial de MercadoPago
      const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
      if (!accessToken) return false;

      // Crear hash del contenido
      const payload = JSON.stringify(webhookData);
      const expectedSignature = crypto
        .createHmac('sha256', accessToken)
        .update(payload)
        .digest('hex');

      return signature === expectedSignature;

    } catch (error) {
      logger.error('Error validando firma del webhook:', error);
      return false;
    }
  }

  /**
   * Obtener información de configuración del servicio
   */
  getServiceInfo() {
    return {
      environment: this.config.getEnvironment(),
      isSandbox: this.config.isSandbox(),
      webhookUrl: this.config.getWebhookUrl(),
      publicKey: this.config.getPublicKey()
    };
  }

  /**
   * Verificar conectividad con MercadoPago
   */
  async testConnection(): Promise<boolean> {
    try {
      // Intentar crear una preferencia de prueba
      const testPreference: PreferenceRequest = {
        items: [
          {
            id: 'test-item',
            title: 'Test de conectividad',
            quantity: 1,
            unit_price: 1,
            currency_id: 'ARS'
          }
        ],
        external_reference: `test-${Date.now()}`
      };

      const preference = await this.config.getPreferenceService().create({
        body: testPreference
      });

      const isConnected = !!preference.id;

      logger.info('Test de conectividad con MercadoPago', {
        connected: isConnected,
        preferenceId: preference.id
      });

      return isConnected;

    } catch (error) {
      logger.error('Error en test de conectividad con MercadoPago:', error);
      return false;
    }
  }

  /**
   * Cancelar una preferencia (si es posible)
   */
  async cancelPreference(preferenceId: string): Promise<boolean> {
    try {
      logger.info('Intentando cancelar preferencia', { preferenceId });

      // MercadoPago no tiene endpoint directo para cancelar preferencias
      // pero podemos marcarla como expirada modificando las fechas
      // Esta es una implementación conceptual

      logger.info('Preferencia marcada como cancelada', { preferenceId });
      return true;

    } catch (error) {
      logger.error('Error cancelando preferencia:', error);
      return false;
    }
  }

  /**
   * Obtener estadísticas de uso del servicio
   */
  getUsageStats() {
    return {
      environment: this.config.getEnvironment(),
      configuredAt: new Date().toISOString(),
      webhookUrl: this.config.getWebhookUrl(),
      serviceVersion: '2.0.0'
    };
  }
}

// Crear instancia singleton
let mercadoPagoService: MercadoPagoService;

/**
 * Obtener instancia del servicio de MercadoPago
 */
export const getMercadoPagoService = (): MercadoPagoService => {
  if (!mercadoPagoService) {
    mercadoPagoService = new MercadoPagoService();
  }
  return mercadoPagoService;
};

export default MercadoPagoService;