import { Student } from '@prisma/client';

export interface StudentProfileResponse {
  student: Pick<
    Student,
    'id' | 'firstName' | 'lastName' | 'studentNo' | 'grade' | 'section'
  >;
  semesterName: string;
  totalIncidents: number;
  totalPraises: number;
  behaviorScore: number;
  positivePercent: number;
}
