import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { config } from './env.js';

class RealtimeEventBus extends EventEmitter {
  constructor() {
    super();
    this.redisPublisher = null;
    this.redisSubscriber = null;
    this.isRedisConnected = false;
  }

  async init() {
    if (config.nodeEnv === 'production' && !process.env.REDIS_URL) {
      console.log('📦 REDIS_URL no configurado: usando EventEmitter local para SSE en tiempo real');
      this.isRedisConnected = false;
      return;
    }
    try {
      this.redisPublisher = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        retryStrategy: () => null // don't spam reconnect if offline
      });

      this.redisPublisher.on('connect', () => {
        this.isRedisConnected = true;
        console.log('✅ Conectado a Redis para Pub/Sub y Rate-Limit distribuido');
      });

      this.redisPublisher.on('error', (err) => {
        if (!this.isRedisConnected) {
          // Expected when offline
        } else {
          console.warn('⚠️ Error en conexión Redis:', err.message);
        }
      });

      this.redisSubscriber = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        retryStrategy: () => null
      });

      this.redisSubscriber.on('error', (err) => {
        // Silently handle offline error during local dev
      });

      this.redisSubscriber.on('message', (channel, message) => {
        try {
          const parsed = JSON.parse(message);
          this.emit(channel, parsed);
        } catch (e) {
          this.emit(channel, message);
        }
      });
    } catch (e) {
      console.log('📦 Redis offline: Usando EventEmitter local para tiempo real');
      this.isRedisConnected = false;
    }
  }

  async publish(channel, data) {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    if (this.isRedisConnected && this.redisPublisher) {
      try {
        await this.redisPublisher.publish(channel, payload);
      } catch (e) {
        // Fallback local
        this.emit(channel, data);
      }
    } else {
      // Local emit
      this.emit(channel, data);
    }
  }

  async subscribeChannel(channel, handler) {
    if (this.isRedisConnected && this.redisSubscriber) {
      try {
        await this.redisSubscriber.subscribe(channel);
      } catch (e) {
        // ignore
      }
    }
    this.on(channel, handler);
  }

  unsubscribeChannel(channel, handler) {
    this.off(channel, handler);
  }
}

export const eventBus = new RealtimeEventBus();
