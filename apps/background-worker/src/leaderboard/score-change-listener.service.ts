import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Client } from 'pg';

type ScoreChangeEvent = {
  table: string;
  id: string;
  operation: string;
  occurredAt?: string;
};

@Injectable()
export class ScoreChangeListenerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ScoreChangeListenerService.name);
  private client: Client | null = null;
  private readonly channel = 'leaderboard_score_changed';
  private readonly buffer = new Map<string, ScoreChangeEvent>();

  async onModuleInit() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      this.logger.warn(
        'DATABASE_URL is not defined; leaderboard listener disabled.',
      );
      return;
    }

    this.client = new Client({ connectionString });

    this.client.on('error', (error) => {
      this.logger.error('PostgreSQL notification client error', error);
    });

    this.client.on('notification', (msg) => {
      if (msg.channel !== this.channel || !msg.payload) {
        return;
      }

      try {
        const event = JSON.parse(msg.payload) as ScoreChangeEvent;
        if (!event.id || !event.table) {
          return;
        }
        const key = `${event.table}:${event.id}`;
        this.buffer.set(key, event);
      } catch (error) {
        this.logger.error(
          'Failed to parse leaderboard notification payload',
          error as Error,
        );
      }
    });

    try {
      await this.client.connect();
      await this.client.query(`LISTEN ${this.channel}`);
      this.logger.log(
        `Listening for leaderboard score changes on channel "${this.channel}".`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to establish LISTEN/NOTIFY connection',
        error as Error,
      );
      await this.safeShutdown();
    }
  }

  async onModuleDestroy() {
    await this.safeShutdown();
  }

  drainEvents(): ScoreChangeEvent[] {
    if (!this.buffer.size) {
      return [];
    }

    const events = Array.from(this.buffer.values());
    this.buffer.clear();
    return events;
  }

  private async safeShutdown() {
    if (!this.client) {
      return;
    }

    try {
      await this.client.query(`UNLISTEN ${this.channel}`);
    } catch (error) {
      this.logger.warn(
        'Failed to unlisten from channel during shutdown',
        error as Error,
      );
    } finally {
      try {
        await this.client.end();
      } catch (error) {
        this.logger.warn(
          'Failed to close PostgreSQL notification client',
          error as Error,
        );
      }
      this.client = null;
    }
  }
}
