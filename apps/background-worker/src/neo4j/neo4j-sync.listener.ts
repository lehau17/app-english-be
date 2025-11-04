import { PrismaRepository } from '@app/database';
import {
  KafkaConfigService,
  KafkaTopic,
  Neo4jEntityType,
  Neo4jService,
  Neo4jSyncMessage,
  Neo4jSyncOperation,
} from '@app/shared';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Consumer, Kafka } from 'kafkajs';

@Injectable()
export class Neo4jSyncListener implements OnModuleInit, OnModuleDestroy {
  private consumer: Consumer;
  private kafka: Kafka;
  private readonly logger = new Logger(Neo4jSyncListener.name);

  constructor(
    private readonly kafkaConfigService: KafkaConfigService,
    private readonly prisma: PrismaRepository,
    private readonly neo4jService: Neo4jService,
  ) {
    this.kafka = new Kafka(this.kafkaConfigService.getConsumerConfig());
    this.consumer = this.kafka.consumer({
      groupId: 'background-worker-neo4j-sync',
      retry: {
        initialRetryTime: 300,
        retries: 3,
        maxRetryTime: 30000,
        factor: 0.2,
        multiplier: 2,
      },
    });
  }

  async onModuleInit() {
    try {
      await this.consumer.connect();
      this.logger.log('✅ Neo4j sync listener connected to Kafka');

      await this.consumer.subscribe({
        topics: [KafkaTopic.NEO4J_SYNC],
        fromBeginning: false,
      });
      this.logger.log(`✅ Subscribed to topic: ${KafkaTopic.NEO4J_SYNC}`);

      // Event listeners
      this.consumer.on(this.consumer.events.GROUP_JOIN, (e) =>
        this.logger.log('GROUP_JOIN', e.payload),
      );
      this.consumer.on(this.consumer.events.CRASH, (e) =>
        this.logger.error('CRASH', e.payload.error),
      );
      this.consumer.on(this.consumer.events.CONNECT, () =>
        this.logger.log('Consumer connected'),
      );

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          await this.processMessage(topic, partition, message);
        },
      });

      this.logger.log('✅ Neo4j sync consumer running');
    } catch (error) {
      this.logger.error('Failed to initialize Neo4j sync listener', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.consumer.disconnect();
      this.logger.log('Neo4j sync listener disconnected');
    } catch (error) {
      this.logger.error('Failed to disconnect Neo4j sync listener', error);
    }
  }

  private async processMessage(topic: string, partition: number, message: any) {
    const key = message.key?.toString();
    const raw = message.value?.toString();

    this.logger.log('Received message:', {
      topic,
      partition,
      key,
      offset: message.offset,
    });

    if (!raw) {
      return this.logger.warn('Received empty message', { topic, partition });
    }

    const startTime = Date.now();

    try {
      const payload: Neo4jSyncMessage = JSON.parse(raw);

      this.logger.log(
        `Processing Neo4j sync: ${payload.operation} ${payload.entityType} ${payload.entityId}`,
      );

      await this.syncEntity(payload);

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `✅ Neo4j sync completed for ${payload.entityType} ${payload.entityId} in ${processingTime}ms`,
      );
    } catch (err) {
      this.logger.error('Message processing failed:', {
        topic,
        partition,
        key,
        error: err.message,
        stack: err.stack,
      });
    }
  }

  private async syncEntity(message: Neo4jSyncMessage): Promise<void> {
    switch (message.operation) {
      case Neo4jSyncOperation.CREATE:
      case Neo4jSyncOperation.UPDATE:
        await this.syncEntityData(message);
        break;
      case Neo4jSyncOperation.DELETE:
        await this.deleteEntity(message);
        break;
      default:
        throw new Error(`Unknown operation: ${message.operation}`);
    }
  }

  private async syncEntityData(message: Neo4jSyncMessage): Promise<void> {
    switch (message.entityType) {
      case Neo4jEntityType.COURSE:
        await this.syncCourse(message.entityId);
        break;
      case Neo4jEntityType.LESSON:
        await this.syncLesson(message.entityId);
        break;
      case Neo4jEntityType.ACTIVITY:
        await this.syncActivity(message.entityId);
        break;
      default:
        throw new Error(`Unknown entity type: ${message.entityType}`);
    }
  }

  private async syncCourse(courseId: string): Promise<void> {
    this.logger.debug(`Syncing course ${courseId} to Neo4j`);

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        instructor: true,
        lessons: {
          include: {
            activities: true,
          },
        },
      },
    });

    if (!course) {
      throw new Error(`Course not found: ${courseId}`);
    }

    // Create or update course entity in Neo4j
    // Note: Neo4j requires all properties to be primitive types or arrays
    const cypher = `
      MERGE (c:Entity {id: $id})
      SET c.type = 'COURSE',
          c.name = $name,
          c.description = $description,
          c.sourceTable = 'courses',
          c.sourceId = $id,
          c.difficulty = $difficulty,
          c.language = $language,
          c.isPublished = $isPublished,
          c.price = $price,
          c.totalLessons = $totalLessons,
          c.totalDuration = $totalDuration,
          c.instructorId = $instructorId,
          c.tags = $tags,
          c.updatedAt = datetime()
      RETURN c
    `;

    await this.neo4jService.runQuery(cypher, {
      id: course.id,
      name: course.title,
      description: course.description || '',
      difficulty: course.difficulty,
      language: course.language,
      isPublished: course.isPublished,
      price: Number(course.price) || 0,
      totalLessons: course.totalLessons,
      totalDuration: course.totalDuration,
      instructorId: course.instructorId,
      tags: course.tags || [],
    });

    // Sync all lessons and activities
    for (const lesson of course.lessons) {
      await this.syncLesson(lesson.id);

      // Create CONTAINS relationship from course to lesson
      await this.createRelationship(course.id, lesson.id, 'CONTAINS', {
        orderNo: lesson.orderNo,
      });

      for (const activity of lesson.activities) {
        await this.syncActivity(activity.id);

        // Create CONTAINS relationship from lesson to activity
        await this.createRelationship(lesson.id, activity.id, 'CONTAINS', {
          orderNo: activity.orderNo,
        });
      }
    }

    this.logger.debug(
      `Course ${courseId} synced with ${course.lessons.length} lessons`,
    );
  }

  private async syncLesson(lessonId: string): Promise<void> {
    this.logger.debug(`Syncing lesson ${lessonId} to Neo4j`);

    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        course: true,
      },
    });

    if (!lesson) {
      throw new Error(`Lesson not found: ${lessonId}`);
    }

    const cypher = `
      MERGE (l:Entity {id: $id})
      SET l.type = 'LESSON',
          l.name = $name,
          l.description = $description,
          l.sourceTable = 'lessons',
          l.sourceId = $id,
          l.difficulty = $difficulty,
          l.orderNo = $orderNo,
          l.estimatedTime = $estimatedTime,
          l.isLocked = $isLocked,
          l.courseId = $courseId,
          l.objectives = $objectives,
          l.updatedAt = datetime()
      RETURN l
    `;

    await this.neo4jService.runQuery(cypher, {
      id: lesson.id,
      name: lesson.title,
      description: lesson.description || '',
      difficulty: lesson.difficulty,
      orderNo: lesson.orderNo,
      estimatedTime: lesson.estimatedTime,
      isLocked: lesson.isLocked,
      courseId: lesson.courseId,
      objectives: lesson.objectives || [],
    });
  }

  private async syncActivity(activityId: string): Promise<void> {
    this.logger.debug(`Syncing activity ${activityId} to Neo4j`);

    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        lesson: true,
      },
    });

    if (!activity) {
      throw new Error(`Activity not found: ${activityId}`);
    }

    const cypher = `
      MERGE (a:Entity {id: $id})
      SET a.type = 'ACTIVITY',
          a.name = $name,
          a.description = $description,
          a.sourceTable = 'activities',
          a.sourceId = $id,
          a.activityType = $activityType,
          a.difficulty = $difficulty,
          a.orderNo = $orderNo,
          a.timeLimit = $timeLimit,
          a.points = $points,
          a.lessonId = $lessonId,
          a.updatedAt = datetime()
      RETURN a
    `;

    await this.neo4jService.runQuery(cypher, {
      id: activity.id,
      name: activity.title,
      description: activity.instructions || activity.title,
      activityType: activity.type,
      difficulty: activity.difficulty,
      orderNo: activity.orderNo,
      timeLimit: activity.timeLimit,
      points: activity.points,
      lessonId: activity.lessonId,
    });
  }

  private async deleteEntity(message: Neo4jSyncMessage): Promise<void> {
    this.logger.debug(
      `Deleting ${message.entityType} ${message.entityId} from Neo4j`,
    );

    const cypher = `
      MATCH (e:Entity {id: $id})
      DETACH DELETE e
    `;

    await this.neo4jService.runQuery(cypher, {
      id: message.entityId,
    });

    this.logger.debug(
      `Deleted ${message.entityType} ${message.entityId} from Neo4j`,
    );
  }

  private async createRelationship(
    sourceId: string,
    targetId: string,
    type: string,
    properties: Record<string, any> = {},
  ): Promise<void> {
    // Build SET clause with flattened properties
    const setProps = Object.entries(properties)
      .map(([key, _]) => `r.${key} = $${key}`)
      .join(', ');

    const cypher = `
      MATCH (source:Entity {id: $sourceId})
      MATCH (target:Entity {id: $targetId})
      MERGE (source)-[r:${type}]->(target)
      SET r.updatedAt = datetime()
      ${setProps ? `, ${setProps}` : ''}
      RETURN r
    `;

    await this.neo4jService.runQuery(cypher, {
      sourceId,
      targetId,
      ...properties,
    });
  }
}
