import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import neo4j, { Driver, Session } from 'neo4j-driver';

@Injectable()
export class Neo4jService implements OnModuleInit {
  private driver: Driver;
  private readonly logger = new Logger(Neo4jService.name);

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const uri = this.configService.get<string>(
      'NEO4J_URI',
      'bolt://localhost:7687',
    );
    const username = this.configService.get<string>('NEO4J_USERNAME', 'neo4j');
    const password = this.configService.get<string>(
      'NEO4J_PASSWORD',
      'neo4j123456',
    );

    this.logger.log(`🔌 Connecting to Neo4j at ${uri}...`);

    this.driver = neo4j.driver(uri, neo4j.auth.basic(username, password), {
      maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 2 * 60 * 1000, // 2 minutes
    });

    // Test connection
    try {
      const session = this.driver.session();
      await session.run('RETURN 1');
      await session.close();
      this.logger.log('✅ Neo4j connected successfully');
    } catch (error) {
      this.logger.error('❌ Failed to connect to Neo4j', error);
      throw error;
    }
  }

  getDriver(): Driver {
    return this.driver;
  }

  getSession(database?: string): Session {
    return this.driver.session({
      database: database || 'neo4j',
      defaultAccessMode: neo4j.session.WRITE,
    });
  }

  async close() {
    if (this.driver) {
      this.logger.log('🔌 Closing Neo4j connection...');
      await this.driver.close();
      this.logger.log('✅ Neo4j connection closed');
    }
  }

  // Helper method to run query with automatic session management
  async runQuery<T = any>(
    cypher: string,
    params: Record<string, any> = {},
  ): Promise<T[]> {
    const session = this.getSession();
    try {
      const result = await session.run(cypher, params);
      return result.records.map((record) => record.toObject() as T);
    } finally {
      await session.close();
    }
  }

  // Helper method to run write transaction
  async runWriteTransaction<T = any>(
    work: (tx: any) => Promise<T>,
  ): Promise<T> {
    const session = this.getSession();
    try {
      return await session.executeWrite(work);
    } finally {
      await session.close();
    }
  }

  // Helper method to run read transaction
  async runReadTransaction<T = any>(work: (tx: any) => Promise<T>): Promise<T> {
    const session = this.getSession();
    try {
      return await session.executeRead(work);
    } finally {
      await session.close();
    }
  }
}
