export enum Neo4jSyncOperation {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

export enum Neo4jEntityType {
  COURSE = 'COURSE',
  LESSON = 'LESSON',
  ACTIVITY = 'ACTIVITY',
}

export interface Neo4jSyncMessage {
  operation: Neo4jSyncOperation;
  entityType: Neo4jEntityType;
  entityId: string;
  taskId: string; // unique task identifier
  timestamp: number;
  metadata?: {
    courseId?: string; // For lessons/activities
    lessonId?: string; // For activities
    [key: string]: any;
  };
}

export interface Neo4jSyncResult {
  entityId: string;
  entityType: Neo4jEntityType;
  operation: Neo4jSyncOperation;
  taskId: string;
  success: boolean;
  errorMessage?: string;
  timestamp: number;
  processingTimeMs?: number;
}
