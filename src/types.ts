export interface AlarmThresholds {
  warning: number;
  danger: number;
}

export interface EquipmentAlarms {
  termografia?: AlarmThresholds;
  vibraciones?: AlarmThresholds;
  ultrasonido?: AlarmThresholds;
}

export interface Equipment {
  id: string;
  name: string;
  techniques: string[];
  driveType: string;
  inspectionPoints: string[];
  alarms?: EquipmentAlarms;
  aiAnalysis?: string;
  aiRecommendations?: string;
  authorUid: string;
  createdAt: any;
}

export interface MaintenanceRecord {
  id: string;
  omNumber: string;
  equipmentId?: string;
  equipmentName: string;
  measurementPoint: string;
  technique: 'termografia' | 'ultrasonido' | 'vibraciones';
  value: number;
  unit: string;
  notes?: string;
  createdAt: any; // Firestore Timestamp
  authorUid: string;
  authorName?: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
