import { PrismaClient, UserRole, IncidentStatus, CategoryGroup, ActionType, ActionStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');
  
  // ===================== CLEANUP: Delete all existing data =====================
  console.log('🧹 Cleaning up existing data...');
  
  
  await prisma.triggeredAction.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.disciplineRule.deleteMany();
  await prisma.infractionCategory.deleteMany();
  await prisma.semesterConfig.deleteMany();
  await prisma.student.deleteMany();
  await prisma.user.deleteMany();
  await prisma.school.deleteMany();
  
  console.log('✅ All existing data removed');

  const password = await bcrypt.hash('password123', 10);
  const now = new Date();

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║  SCHOOL 1: İzlem Academy                                          ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  const school1 = await prisma.school.create({
    data: { id: 'school_1', name: 'İzlem Academy', code: 'IZLEM001' },
  });
  console.log('✅ School 1 created:', school1.name);

  // ── Semester ──
  await prisma.semesterConfig.create({
    data: {
      name: '2024-2025 Fall Term',
      startDate: new Date('2024-09-02'),
      endDate: new Date('2025-01-17'),
      isCurrent: true,
      schoolId: school1.id,
    },
  });

  // ── Users ──
  const admin1 = await prisma.user.create({
    data: {
      id: 'user_admin_1',
      email: 'admin@izlem.com',
      password,
      firstName: 'Okan',
      lastName: 'Fidan',
      role: UserRole.ADMIN,
      isActive: true,
      schoolId: school1.id,
    },
  });

  const teacher1 = await prisma.user.create({
    data: {
      id: 'user_teacher_1',
      email: 'teacher@izlem.com',
      password,
      firstName: 'Ayşe',
      lastName: 'Öztürk',
      role: UserRole.TEACHER,
      isActive: true,
      schoolId: school1.id,
    },
  });

  const guide1 = await prisma.user.create({
    data: {
      id: 'user_guide_1',
      email: 'guide@izlem.com',
      password,
      firstName: 'Mehmet',
      lastName: 'Kaya',
      role: UserRole.GUIDE_TEACHER,
      isActive: true,
      schoolId: school1.id,
    },
  });

  // Pending user (awaiting approval)
  await prisma.user.create({
    data: {
      id: 'user_pending_1',
      email: 'pending@izlem.com',
      password,
      firstName: 'Deniz',
      lastName: 'Yıldırım',
      role: UserRole.TEACHER,
      isActive: false,
      schoolId: school1.id,
    },
  });

  console.log('✅ School 1 users created');

  // ── Categories ──
  const s1Cats: any[] = [];

  const s1DisciplineCats = [
    { name: 'Late to Class', description: 'Student arrived late to class', points: 5 },
    { name: 'No Uniform', description: 'Student not wearing proper uniform', points: 5 },
    { name: 'Disruptive Behavior', description: 'Disrupting class or other students', points: 10 },
    { name: 'Phone Usage', description: 'Using phone during class hours', points: 5 },
    { name: 'Homework Not Done', description: 'Failed to complete assigned homework', points: 3 },
    { name: 'Aggressive Behavior', description: 'Physical or verbal aggression', points: 20 },
  ];

  const s1PraiseCats = [
    { name: 'Excellent Performance', description: 'Outstanding academic achievement', points: 10 },
    { name: 'Helping Peers', description: 'Helping classmates with studies', points: 5 },
    { name: 'Class Participation', description: 'Active participation in class', points: 3 },
    { name: 'Leadership', description: 'Showing leadership qualities', points: 8 },
  ];

  for (const cat of s1DisciplineCats) {
    s1Cats.push(await prisma.infractionCategory.create({
      data: { ...cat, group: CategoryGroup.DISCIPLINE, schoolId: school1.id },
    }));
  }
  for (const cat of s1PraiseCats) {
    s1Cats.push(await prisma.infractionCategory.create({
      data: { ...cat, group: CategoryGroup.PRAISE, schoolId: school1.id },
    }));
  }
  console.log('✅ School 1 categories created:', s1Cats.length);

  // ── Progressive Discipline Rules ──
  const s1Late = s1Cats.find(c => c.name === 'Late to Class')!;
  const s1Uniform = s1Cats.find(c => c.name === 'No Uniform')!;
  const s1Disruptive = s1Cats.find(c => c.name === 'Disruptive Behavior')!;
  const s1Excellent = s1Cats.find(c => c.name === 'Excellent Performance')!;
  const s1Leadership = s1Cats.find(c => c.name === 'Leadership')!;

  // Late to Class: 3 → Warning, 5 → Notify Parent, 10 → Detention
  const s1Rules: any[] = [];
  for (const r of [
    { description: '3rd late — verbal warning issued', actionType: ActionType.LOG_WARNING, threshold: 3, categoryId: s1Late.id },
    { description: '5th late — parent notification sent', actionType: ActionType.NOTIFY_PARENT, threshold: 5, categoryId: s1Late.id },
    { description: '10th late — detention assigned', actionType: ActionType.ASSIGN_DETENTION, threshold: 10, categoryId: s1Late.id },
    { description: '2nd uniform violation — warning logged', actionType: ActionType.LOG_WARNING, threshold: 2, categoryId: s1Uniform.id },
    { description: '4th uniform violation — parent notification', actionType: ActionType.NOTIFY_PARENT, threshold: 4, categoryId: s1Uniform.id },
    { description: '1st disruption — warning issued', actionType: ActionType.LOG_WARNING, threshold: 1, categoryId: s1Disruptive.id },
    { description: '2nd disruption — admin meeting required', actionType: ActionType.REQUIRE_ADMIN_MEETING, threshold: 2, categoryId: s1Disruptive.id },
    { description: '3rd disruption — detention assigned', actionType: ActionType.ASSIGN_DETENTION, threshold: 3, categoryId: s1Disruptive.id },
    { description: '5th excellence — positive reward earned', actionType: ActionType.POSITIVE_REWARD, threshold: 5, categoryId: s1Excellent.id },
    { description: '3rd leadership act — leadership badge earned', actionType: ActionType.POSITIVE_REWARD, threshold: 3, categoryId: s1Leadership.id },
  ]) {
    s1Rules.push(await prisma.disciplineRule.create({
      data: { ...r, schoolId: school1.id },
    }));
  }
  console.log('✅ School 1 rules created:', s1Rules.length);

  // ── Students ──
  const s1Students: any[] = [];
  for (const stu of [
    { firstName: 'Ali', lastName: 'Yılmaz', studentNo: 'STU001', grade: '9', section: 'A' },
    { firstName: 'Zeynep', lastName: 'Kara', studentNo: 'STU002', grade: '9', section: 'A' },
    { firstName: 'Emre', lastName: 'Demir', studentNo: 'STU003', grade: '9', section: 'B' },
    { firstName: 'Elif', lastName: 'Çelik', studentNo: 'STU004', grade: '10', section: 'A' },
    { firstName: 'Burak', lastName: 'Şahin', studentNo: 'STU005', grade: '10', section: 'B' },
    { firstName: 'Selin', lastName: 'Arslan', studentNo: 'STU006', grade: '10', section: 'A' },
    { firstName: 'Can', lastName: 'Koç', studentNo: 'STU007', grade: '11', section: 'A' },
    { firstName: 'Defne', lastName: 'Aydın', studentNo: 'STU008', grade: '11', section: 'B' },
    { firstName: 'Kerem', lastName: 'Özkan', studentNo: 'STU009', grade: '12', section: 'A' },
    { firstName: 'İrem', lastName: 'Yıldız', studentNo: 'STU010', grade: '12', section: 'A' },
  ]) {
    s1Students.push(await prisma.student.create({
      data: { ...stu, schoolId: school1.id },
    }));
  }
  console.log('✅ School 1 students created:', s1Students.length);

  // ── Parent User (linked to Ali & Zeynep) ──
  await prisma.user.create({
    data: {
      id: 'user_parent_1',
      email: 'parent@izlem.com',
      password,
      firstName: 'Hasan',
      lastName: 'Yılmaz',
      role: UserRole.PARENT,
      isActive: true,
      schoolId: school1.id,
      students: { connect: [{ id: s1Students[0].id }, { id: s1Students[1].id }] },
    },
  });

  // ── Dispatched Incidents (active today) ──
  for (const inc of [
    { studentIdx: 0, catName: 'Late to Class', minutesAgo: 5 },
    { studentIdx: 1, catName: 'Phone Usage', minutesAgo: 12 },
    { studentIdx: 2, catName: 'Disruptive Behavior', minutesAgo: 18 },
  ]) {
    const stu = s1Students[inc.studentIdx];
    const cat = s1Cats.find(c => c.name === inc.catName)!;
    await prisma.incident.create({
      data: {
        description: `${stu.firstName} - ${cat.name}`,
        status: IncidentStatus.DISPATCHED,
        dispatchedAt: new Date(now.getTime() - inc.minutesAgo * 60000),
        studentId: stu.id,
        categoryId: cat.id,
        createdById: teacher1.id,
        schoolId: school1.id,
        visibleToParent: true,
      },
    });
  }

  // ── Received Incidents ──
  for (const inc of [
    { studentIdx: 3, catName: 'No Uniform', minutesAgo: 60 },
    { studentIdx: 4, catName: 'Homework Not Done', minutesAgo: 120 },
    { studentIdx: 5, catName: 'Late to Class', minutesAgo: 180 },
  ]) {
    const stu = s1Students[inc.studentIdx];
    const cat = s1Cats.find(c => c.name === inc.catName)!;
    const dispatchedAt = new Date(now.getTime() - inc.minutesAgo * 60000);
    await prisma.incident.create({
      data: {
        description: `${stu.firstName} - ${cat.name}`,
        status: IncidentStatus.RECEIVED,
        dispatchedAt,
        receivedAt: new Date(dispatchedAt.getTime() + 8 * 60000),
        studentId: stu.id,
        categoryId: cat.id,
        createdById: teacher1.id,
        receivedById: guide1.id,
        schoolId: school1.id,
        visibleToParent: true,
      },
    });
  }

  // ── Praise Incidents ──
  for (const inc of [
    { studentIdx: 6, catName: 'Excellent Performance', minutesAgo: 30 },
    { studentIdx: 7, catName: 'Helping Peers', minutesAgo: 45 },
  ]) {
    const stu = s1Students[inc.studentIdx];
    const cat = s1Cats.find(c => c.name === inc.catName)!;
    const dispatchedAt = new Date(now.getTime() - inc.minutesAgo * 60000);
    await prisma.incident.create({
      data: {
        description: `${stu.firstName} - ${cat.name}`,
        status: IncidentStatus.RECEIVED,
        dispatchedAt,
        receivedAt: dispatchedAt,
        studentId: stu.id,
        categoryId: cat.id,
        createdById: teacher1.id,
        receivedById: guide1.id,
        schoolId: school1.id,
        visibleToParent: true,
      },
    });
  }
  console.log('✅ School 1 incidents created');

  // ── Triggered Actions — COMPLETED (resolved) ──
  const s1ExcellentRule = s1Rules.find(r => r.categoryId === s1Excellent.id)!;
  const s1LeadershipRule = s1Rules.find(r => r.categoryId === s1Leadership.id)!;

  // Ali's completed positive reward
  const aliRewardIncident = await prisma.incident.create({
    data: {
      description: 'System: 5th excellence reward',
      status: IncidentStatus.RESOLVED,
      dispatchedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      studentId: s1Students[0].id,
      categoryId: s1Excellent.id,
      createdById: teacher1.id,
      schoolId: school1.id,
      visibleToParent: true,
    },
  });
  await prisma.triggeredAction.create({
    data: {
      actionType: ActionType.POSITIVE_REWARD,
      status: ActionStatus.COMPLETED,
      count: 5,
      studentId: s1Students[0].id,
      ruleId: s1ExcellentRule.id,
      schoolId: school1.id,
      incidentId: aliRewardIncident.id,
      createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      resolutionOutcome: 'SUCCESSFUL',
      resolutionNote: 'Certificate of Excellence awarded during assembly.',
      resolvedAt: new Date(now.getTime() - 20 * 60 * 60 * 1000),
      resolvedById: guide1.id,
    },
  });

  // Zeynep's completed leadership reward
  const zeynepRewardIncident = await prisma.incident.create({
    data: {
      description: 'System: Leadership badge',
      status: IncidentStatus.RESOLVED,
      dispatchedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      studentId: s1Students[1].id,
      categoryId: s1Leadership.id,
      createdById: teacher1.id,
      schoolId: school1.id,
      visibleToParent: true,
    },
  });
  await prisma.triggeredAction.create({
    data: {
      actionType: ActionType.POSITIVE_REWARD,
      status: ActionStatus.COMPLETED,
      count: 3,
      studentId: s1Students[1].id,
      ruleId: s1LeadershipRule.id,
      schoolId: school1.id,
      incidentId: zeynepRewardIncident.id,
      createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      resolutionOutcome: 'SUCCESSFUL',
      resolutionNote: 'Leadership badge given. Student mentored 2 freshmen.',
      resolvedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
      resolvedById: guide1.id,
    },
  });
  console.log('✅ School 1 resolved triggered actions created');

  // ── Triggered Actions — PENDING (flagged, awaiting resolution) ──
  const s1LateWarningRule = s1Rules.find(r => r.categoryId === s1Late.id && r.threshold === 3)!;
  const s1DisruptionWarningRule = s1Rules.find(r => r.categoryId === s1Disruptive.id && r.threshold === 1)!;

  // Emre flagged: 3rd late → warning pending
  const emreFlagIncident = await prisma.incident.create({
    data: {
      description: 'Emre - 3rd late to class this semester',
      status: IncidentStatus.RECEIVED,
      dispatchedAt: new Date(now.getTime() - 45 * 60000),
      receivedAt: new Date(now.getTime() - 40 * 60000),
      studentId: s1Students[2].id,
      categoryId: s1Late.id,
      createdById: teacher1.id,
      receivedById: guide1.id,
      schoolId: school1.id,
      visibleToParent: true,
    },
  });
  await prisma.triggeredAction.create({
    data: {
      actionType: ActionType.LOG_WARNING,
      status: ActionStatus.PENDING,
      count: 3,
      studentId: s1Students[2].id,
      ruleId: s1LateWarningRule.id,
      schoolId: school1.id,
      incidentId: emreFlagIncident.id,
    },
  });

  // Burak flagged: disruptive behavior → warning pending
  const burakFlagIncident = await prisma.incident.create({
    data: {
      description: 'Burak - disrupted class activity',
      status: IncidentStatus.RECEIVED,
      dispatchedAt: new Date(now.getTime() - 30 * 60000),
      receivedAt: new Date(now.getTime() - 25 * 60000),
      studentId: s1Students[4].id,
      categoryId: s1Disruptive.id,
      createdById: teacher1.id,
      receivedById: guide1.id,
      schoolId: school1.id,
      visibleToParent: true,
    },
  });
  await prisma.triggeredAction.create({
    data: {
      actionType: ActionType.LOG_WARNING,
      status: ActionStatus.PENDING,
      count: 1,
      studentId: s1Students[4].id,
      ruleId: s1DisruptionWarningRule.id,
      schoolId: school1.id,
      incidentId: burakFlagIncident.id,
    },
  });
  console.log('✅ School 1 PENDING flagged actions created (Emre, Burak)');

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║  SCHOOL 2: Anatolian Heights High School                          ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  const school2 = await prisma.school.create({
    data: { id: 'school_2', name: 'Anatolian Heights High School', code: 'AHHS002' },
  });
  console.log('\n✅ School 2 created:', school2.name);

  // ── Semester ──
  await prisma.semesterConfig.create({
    data: {
      name: '2024-2025 Fall Term',
      startDate: new Date('2024-09-09'),
      endDate: new Date('2025-01-24'),
      isCurrent: true,
      schoolId: school2.id,
    },
  });

  // ── Users ──
  const admin2 = await prisma.user.create({
    data: {
      id: 'user_admin_2',
      email: 'admin@anatolian.edu.tr',
      password,
      firstName: 'Fatma',
      lastName: 'Doğan',
      role: UserRole.ADMIN,
      isActive: true,
      schoolId: school2.id,
    },
  });

  const teacher2a = await prisma.user.create({
    data: {
      id: 'user_teacher_2a',
      email: 'serkan@anatolian.edu.tr',
      password,
      firstName: 'Serkan',
      lastName: 'Yılmaz',
      role: UserRole.TEACHER,
      isActive: true,
      schoolId: school2.id,
    },
  });

  const teacher2b = await prisma.user.create({
    data: {
      id: 'user_teacher_2b',
      email: 'elif.teacher@anatolian.edu.tr',
      password,
      firstName: 'Elif',
      lastName: 'Karaca',
      role: UserRole.TEACHER,
      isActive: true,
      schoolId: school2.id,
    },
  });

  const guide2 = await prisma.user.create({
    data: {
      id: 'user_guide_2',
      email: 'guide@anatolian.edu.tr',
      password,
      firstName: 'Ahmet',
      lastName: 'Çetin',
      role: UserRole.GUIDE_TEACHER,
      isActive: true,
      schoolId: school2.id,
    },
  });

  console.log('✅ School 2 users created');

  // ── Categories ──
  const s2Cats: any[] = [];

  const s2DisciplineCats = [
    { name: 'Late to Class', description: 'Being tardy to class', points: 5 },
    { name: 'No Uniform', description: 'Uniform code violation', points: 5 },
    { name: 'Cheating', description: 'Academic dishonesty during exams', points: 25 },
    { name: 'Bullying', description: 'Bullying or intimidation of peers', points: 20 },
    { name: 'Phone Usage', description: 'Unauthorized mobile phone use', points: 5 },
    { name: 'Skipping Class', description: 'Absent from class without permission', points: 10 },
  ];

  const s2PraiseCats = [
    { name: 'Academic Excellence', description: 'Outstanding grades and effort', points: 10 },
    { name: 'Community Service', description: 'Voluntary community engagement', points: 8 },
    { name: 'Sports Achievement', description: 'Success in school sports', points: 5 },
    { name: 'Creative Work', description: 'Outstanding art, music, or writing', points: 5 },
  ];

  for (const cat of s2DisciplineCats) {
    s2Cats.push(await prisma.infractionCategory.create({
      data: { ...cat, group: CategoryGroup.DISCIPLINE, schoolId: school2.id },
    }));
  }
  for (const cat of s2PraiseCats) {
    s2Cats.push(await prisma.infractionCategory.create({
      data: { ...cat, group: CategoryGroup.PRAISE, schoolId: school2.id },
    }));
  }
  console.log('✅ School 2 categories created:', s2Cats.length);

  // ── Rules ──
  const s2Late = s2Cats.find(c => c.name === 'Late to Class')!;
  const s2Cheating = s2Cats.find(c => c.name === 'Cheating')!;
  const s2Bullying = s2Cats.find(c => c.name === 'Bullying')!;
  const s2Skipping = s2Cats.find(c => c.name === 'Skipping Class')!;
  const s2Excellence = s2Cats.find(c => c.name === 'Academic Excellence')!;
  const s2Community = s2Cats.find(c => c.name === 'Community Service')!;

  const s2Rules: any[] = [];
  for (const r of [
    { description: '3rd late — verbal warning', actionType: ActionType.LOG_WARNING, threshold: 3, categoryId: s2Late.id },
    { description: '6th late — parent meeting', actionType: ActionType.NOTIFY_PARENT, threshold: 6, categoryId: s2Late.id },
    { description: '1st cheating — admin meeting required', actionType: ActionType.REQUIRE_ADMIN_MEETING, threshold: 1, categoryId: s2Cheating.id },
    { description: '2nd cheating — suspension', actionType: ActionType.ASSIGN_DETENTION, threshold: 2, categoryId: s2Cheating.id },
    { description: '1st bullying — admin meeting required', actionType: ActionType.REQUIRE_ADMIN_MEETING, threshold: 1, categoryId: s2Bullying.id },
    { description: '2nd bullying — detention', actionType: ActionType.ASSIGN_DETENTION, threshold: 2, categoryId: s2Bullying.id },
    { description: '2nd skipping — parent notification', actionType: ActionType.NOTIFY_PARENT, threshold: 2, categoryId: s2Skipping.id },
    { description: '5th excellence — honor roll', actionType: ActionType.POSITIVE_REWARD, threshold: 5, categoryId: s2Excellence.id },
    { description: '3rd community service — volunteer badge', actionType: ActionType.POSITIVE_REWARD, threshold: 3, categoryId: s2Community.id },
  ]) {
    s2Rules.push(await prisma.disciplineRule.create({
      data: { ...r, schoolId: school2.id },
    }));
  }
  console.log('✅ School 2 rules created:', s2Rules.length);

  // ── Students ──
  const s2Students: any[] = [];
  for (const stu of [
    { firstName: 'Yağmur', lastName: 'Akın', studentNo: 'AH001', grade: '9', section: 'A' },
    { firstName: 'Barış', lastName: 'Güneş', studentNo: 'AH002', grade: '9', section: 'B' },
    { firstName: 'Ceren', lastName: 'Tunç', studentNo: 'AH003', grade: '10', section: 'A' },
    { firstName: 'Doruk', lastName: 'Esen', studentNo: 'AH004', grade: '10', section: 'A' },
    { firstName: 'Ece', lastName: 'Sarı', studentNo: 'AH005', grade: '10', section: 'B' },
    { firstName: 'Furkan', lastName: 'Aksoy', studentNo: 'AH006', grade: '11', section: 'A' },
    { firstName: 'Gizem', lastName: 'Tekin', studentNo: 'AH007', grade: '11', section: 'A' },
    { firstName: 'Hakan', lastName: 'Polat', studentNo: 'AH008', grade: '12', section: 'A' },
  ]) {
    s2Students.push(await prisma.student.create({
      data: { ...stu, schoolId: school2.id },
    }));
  }
  console.log('✅ School 2 students created:', s2Students.length);

  // ── Parent User (linked to Yağmur & Barış) ──
  await prisma.user.create({
    data: {
      id: 'user_parent_2',
      email: 'parent@anatolian.edu.tr',
      password,
      firstName: 'Mustafa',
      lastName: 'Akın',
      role: UserRole.PARENT,
      isActive: true,
      schoolId: school2.id,
      students: { connect: [{ id: s2Students[0].id }, { id: s2Students[1].id }] },
    },
  });

  // ── Dispatched Incidents ──
  for (const inc of [
    { studentIdx: 0, catName: 'Late to Class', minutesAgo: 8 },
    { studentIdx: 2, catName: 'Phone Usage', minutesAgo: 15 },
    { studentIdx: 5, catName: 'Skipping Class', minutesAgo: 25 },
  ]) {
    const stu = s2Students[inc.studentIdx];
    const cat = s2Cats.find(c => c.name === inc.catName)!;
    await prisma.incident.create({
      data: {
        description: `${stu.firstName} - ${cat.name}`,
        status: IncidentStatus.DISPATCHED,
        dispatchedAt: new Date(now.getTime() - inc.minutesAgo * 60000),
        studentId: stu.id,
        categoryId: cat.id,
        createdById: teacher2a.id,
        schoolId: school2.id,
        visibleToParent: true,
      },
    });
  }

  // ── Received Incidents ──
  for (const inc of [
    { studentIdx: 1, catName: 'No Uniform', minutesAgo: 90 },
    { studentIdx: 3, catName: 'Late to Class', minutesAgo: 150 },
  ]) {
    const stu = s2Students[inc.studentIdx];
    const cat = s2Cats.find(c => c.name === inc.catName)!;
    const dispatchedAt = new Date(now.getTime() - inc.minutesAgo * 60000);
    await prisma.incident.create({
      data: {
        description: `${stu.firstName} - ${cat.name}`,
        status: IncidentStatus.RECEIVED,
        dispatchedAt,
        receivedAt: new Date(dispatchedAt.getTime() + 5 * 60000),
        studentId: stu.id,
        categoryId: cat.id,
        createdById: teacher2b.id,
        receivedById: guide2.id,
        schoolId: school2.id,
        visibleToParent: true,
      },
    });
  }

  // ── Praise Incidents ──
  for (const inc of [
    { studentIdx: 4, catName: 'Academic Excellence', minutesAgo: 20 },
    { studentIdx: 6, catName: 'Community Service', minutesAgo: 50 },
    { studentIdx: 7, catName: 'Sports Achievement', minutesAgo: 70 },
  ]) {
    const stu = s2Students[inc.studentIdx];
    const cat = s2Cats.find(c => c.name === inc.catName)!;
    const dispatchedAt = new Date(now.getTime() - inc.minutesAgo * 60000);
    await prisma.incident.create({
      data: {
        description: `${stu.firstName} - ${cat.name}`,
        status: IncidentStatus.RECEIVED,
        dispatchedAt,
        receivedAt: dispatchedAt,
        studentId: stu.id,
        categoryId: cat.id,
        createdById: teacher2a.id,
        receivedById: guide2.id,
        schoolId: school2.id,
        visibleToParent: true,
      },
    });
  }
  console.log('✅ School 2 incidents created');

  // ── Triggered Actions — COMPLETED (resolved) ──
  const s2ExcellenceRule = s2Rules.find(r => r.categoryId === s2Excellence.id)!;

  const eceRewardIncident = await prisma.incident.create({
    data: {
      description: 'System: Honor roll achievement',
      status: IncidentStatus.RESOLVED,
      dispatchedAt: new Date(now.getTime() - 48 * 60 * 60 * 1000),
      studentId: s2Students[4].id,
      categoryId: s2Excellence.id,
      createdById: teacher2b.id,
      schoolId: school2.id,
      visibleToParent: true,
    },
  });
  await prisma.triggeredAction.create({
    data: {
      actionType: ActionType.POSITIVE_REWARD,
      status: ActionStatus.COMPLETED,
      count: 5,
      studentId: s2Students[4].id,
      ruleId: s2ExcellenceRule.id,
      schoolId: school2.id,
      incidentId: eceRewardIncident.id,
      createdAt: new Date(now.getTime() - 48 * 60 * 60 * 1000),
      resolutionOutcome: 'SUCCESSFUL',
      resolutionNote: 'Honor roll certificate issued at Friday assembly.',
      resolvedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      resolvedById: guide2.id,
    },
  });
  console.log('✅ School 2 resolved triggered action created (Ece)');

  // ── Triggered Actions — PENDING (flagged) ──
  const s2CheatingRule = s2Rules.find(r => r.categoryId === s2Cheating.id && r.threshold === 1)!;
  const s2BullyingRule = s2Rules.find(r => r.categoryId === s2Bullying.id && r.threshold === 1)!;

  // Doruk flagged: 1st cheating → admin meeting pending
  const dorukFlagIncident = await prisma.incident.create({
    data: {
      description: 'Doruk - caught cheating during math exam',
      status: IncidentStatus.RECEIVED,
      dispatchedAt: new Date(now.getTime() - 60 * 60000),
      receivedAt: new Date(now.getTime() - 55 * 60000),
      studentId: s2Students[3].id,
      categoryId: s2Cheating.id,
      createdById: teacher2b.id,
      receivedById: guide2.id,
      schoolId: school2.id,
      visibleToParent: true,
    },
  });
  await prisma.triggeredAction.create({
    data: {
      actionType: ActionType.REQUIRE_ADMIN_MEETING,
      status: ActionStatus.PENDING,
      count: 1,
      studentId: s2Students[3].id,
      ruleId: s2CheatingRule.id,
      schoolId: school2.id,
      incidentId: dorukFlagIncident.id,
    },
  });

  // Furkan flagged: 1st bullying → admin meeting pending
  const furkanFlagIncident = await prisma.incident.create({
    data: {
      description: 'Furkan - reported for bullying a younger student',
      status: IncidentStatus.RECEIVED,
      dispatchedAt: new Date(now.getTime() - 40 * 60000),
      receivedAt: new Date(now.getTime() - 35 * 60000),
      studentId: s2Students[5].id,
      categoryId: s2Bullying.id,
      createdById: teacher2a.id,
      receivedById: guide2.id,
      schoolId: school2.id,
      visibleToParent: true,
    },
  });
  await prisma.triggeredAction.create({
    data: {
      actionType: ActionType.REQUIRE_ADMIN_MEETING,
      status: ActionStatus.PENDING,
      count: 1,
      studentId: s2Students[5].id,
      ruleId: s2BullyingRule.id,
      schoolId: school2.id,
      incidentId: furkanFlagIncident.id,
    },
  });
  console.log('✅ School 2 PENDING flagged actions created (Doruk, Furkan)');

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║  SUMMARY                                                           ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n═══════════════════════════════════════════════════');
  console.log('📋 SCHOOL 1: İzlem Academy (IZLEM001)');
  console.log('═══════════════════════════════════════════════════');
  console.log('   Admin:   admin@izlem.com / password123');
  console.log('   Teacher: teacher@izlem.com / password123');
  console.log('   Guide:   guide@izlem.com / password123');
  console.log('   Parent:  parent@izlem.com / password123  (→ Ali, Zeynep)');
  console.log('   Pending: pending@izlem.com / password123  (awaiting approval)');
  console.log('   Students: 10 | Flagged: Emre (late), Burak (disruptive)');
  console.log('   Resolved: Ali (excellence), Zeynep (leadership)');

  console.log('\n═══════════════════════════════════════════════════');
  console.log('📋 SCHOOL 2: Anatolian Heights High School (AHHS002)');
  console.log('═══════════════════════════════════════════════════');
  console.log('   Admin:   admin@anatolian.edu.tr / password123');
  console.log('   Teacher: serkan@anatolian.edu.tr / password123');
  console.log('   Teacher: elif.teacher@anatolian.edu.tr / password123');
  console.log('   Guide:   guide@anatolian.edu.tr / password123');
  console.log('   Parent:  parent@anatolian.edu.tr / password123  (→ Yağmur, Barış)');
  console.log('   Students: 8 | Flagged: Doruk (cheating), Furkan (bullying)');
  console.log('   Resolved: Ece (honor roll)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });