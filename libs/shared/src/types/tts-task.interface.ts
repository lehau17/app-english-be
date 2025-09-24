export interface TTSTaskMessage {
  activityId: string;
  itemsIndex: number[];
  language: string;
  taskId: string; // unique task identifier
  timestamp: number;
}

export interface TTSTaskResult {
  activityId: string;
  taskId: string;
  success: boolean;
  processedItems: number;
  errorMessage?: string;
  timestamp: number;
}
