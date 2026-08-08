import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma';
import { CreateIncidentDto, UpdateIncidentDto } from './dto';
import { IncidentStatus, Prisma, Incident } from '@prisma/client';
import { IncidentsGateway } from './incidents.gateway';
import { RuleEngineService } from './rule-engine.service';
import { NotificationService } from './notification.service';

const incidentInclude = {
  student: true,
  category: true,
  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
  receivedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
} satisfies Prisma.IncidentInclude;

type IncidentWithDetails = Prisma.IncidentGetPayload<{
  include: typeof incidentInclude;
}>;

@Injectable()
export class IncidentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: IncidentsGateway,
    private readonly ruleEngine: RuleEngineService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(
    schoolId: string,
    userId: string,
    dto: CreateIncidentDto,
  ): Promise<IncidentWithDetails> {
    // Validate that user, student, and category exist
    const [user, student, category] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.student.findUnique({ where: { id: dto.studentId } }),
      this.prisma.infractionCategory.findUnique({
        where: { id: dto.categoryId },
      }),
    ]);

    if (!user) {
      console.error(`❌ User not found: ${userId}`);
      throw new BadRequestException(
        `User with ID ${userId} not found. Please log out and log back in.`,
      );
    }

    if (!student) {
      console.error(`❌ Student not found: ${dto.studentId}`);
      throw new BadRequestException(
        `Student with ID ${dto.studentId} not found.`,
      );
    }

    if (!category) {
      console.error(`❌ Category not found: ${dto.categoryId}`);
      throw new BadRequestException(
        `Category with ID ${dto.categoryId} not found.`,
      );
    }

    console.log(
      `✅ Creating incident: user=${userId}, student=${dto.studentId}, category=${dto.categoryId}, classTerminated=${dto.isClassTerminated}`,
    );

    const tenantDb = this.prisma.forTenant(schoolId);

    const isPraise = category.group === 'PRAISE';
    // Class termination implies lesson termination
    const isLessonTerminated = dto.isClassTerminated || dto.isLessonTerminated || false;
    const isClassTerminated = dto.isClassTerminated || false;

    // Only dispatch student into hallway if it's a discipline incident AND lesson/class was terminated
    const isDispatched = !isPraise && isLessonTerminated;
    const status = isDispatched ? IncidentStatus.DISPATCHED : IncidentStatus.RECEIVED;

    // Build default description if not provided
    let description = dto.description;
    if (!description && isClassTerminated) {
      description = 'Class terminated — Teacher left class';
    } else if (!description && isLessonTerminated) {
      description = 'Student removed from class';
    }

    const incident = await tenantDb.incident.create({
      data: {
        studentId: dto.studentId,
        categoryId: dto.categoryId,
        description,
        notes: dto.notes,
        schoolId,
        createdById: userId,
        status,
        visibleToParent: true,
        isLessonTerminated,
        isClassTerminated,
        dispatchedAt: new Date(),
        ...(!isDispatched
          ? {
              receivedAt: new Date(),
              receivedById: userId,
            }
          : {}),
      },
      include: incidentInclude,
    });

    // Emit real-time event to school room with full incident for direct injection
    this.gateway.emitNewIncident(schoolId, {
      incidentId: incident.id,
      studentName: `${incident.student.firstName} ${incident.student.lastName}`,
      categoryName: incident.category.name,
      teacherName: `${incident.createdBy.firstName} ${incident.createdBy.lastName}`,
      timestamp: incident.dispatchedAt,
      incident, // Full incident object for clients to inject directly
    });

    // Evaluate progressive discipline rules (fire-and-forget)
    this.ruleEngine
      .evaluateRules(schoolId, dto.studentId, dto.categoryId, incident.id)
      .catch((err: unknown) => console.error('Rule engine error:', err));

    // If Class Terminated, send email notifications to all parents in the class/section
    if (isClassTerminated) {
      this.notificationService
        .sendClassTerminationNotifications(schoolId, user, student, category)
        .catch((err: unknown) =>
          console.error('Class termination notification error:', err),
        );
    }

    return incident;
  }

  async findAll(
    schoolId: string,
    todayOnly = false,
  ): Promise<IncidentWithDetails[]> {
    const tenantDb = this.prisma.forTenant(schoolId);

    const where: Prisma.IncidentWhereInput = {
      deletedAt: null,
    };
    if (todayOnly) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      where.dispatchedAt = { gte: startOfDay };
    }

    return (tenantDb.incident as any).findMany({
      where,
      include: incidentInclude,
      orderBy: {
        dispatchedAt: 'desc',
      },
    });
  }

  async findOne(schoolId: string, id: string): Promise<IncidentWithDetails> {
    const tenantDb = this.prisma.forTenant(schoolId);

    const incident = await (tenantDb.incident as any).findFirst({
      where: { id, deletedAt: null },
      include: incidentInclude,
    });

    if (!incident) {
      throw new NotFoundException(`Incident with ID ${id} not found`);
    }

    return incident;
  }

  async update(
    schoolId: string,
    id: string,
    dto: UpdateIncidentDto,
  ): Promise<IncidentWithDetails> {
    await this.findOne(schoolId, id);

    const tenantDb = this.prisma.forTenant(schoolId);

    return tenantDb.incident.update({
      where: { id },
      data: dto,
      include: incidentInclude,
    });
  }

  async receive(
    schoolId: string,
    id: string,
    userId: string,
  ): Promise<IncidentWithDetails> {
    await this.findOne(schoolId, id);

    const tenantDb = this.prisma.forTenant(schoolId);

    const incident = await tenantDb.incident.update({
      where: { id },
      data: {
        status: IncidentStatus.RECEIVED,
        receivedAt: new Date(),
        receivedById: userId,
      },
      include: incidentInclude,
    });

    // Emit real-time event to school room
    this.gateway.emitIncidentReceived(schoolId, {
      incidentId: incident.id,
      studentName: `${incident.student.firstName} ${incident.student.lastName}`,
      receivedByName: incident.receivedBy
        ? `${incident.receivedBy.firstName} ${incident.receivedBy.lastName}`
        : 'Unknown',
      receivedAt: incident.receivedAt!,
    });

    return incident;
  }

  async resolve(
    schoolId: string,
    id: string,
    userId: string,
  ): Promise<IncidentWithDetails> {
    const existing = await this.findOne(schoolId, id);

    if (existing.status !== IncidentStatus.UNACCOUNTED) {
      throw new BadRequestException(
        `Only UNACCOUNTED incidents can be resolved. Current status: ${existing.status}`,
      );
    }

    const tenantDb = this.prisma.forTenant(schoolId);

    const incident = await tenantDb.incident.update({
      where: { id },
      data: {
        status: IncidentStatus.RESOLVED,
        resolvedAt: new Date(),
      },
      include: incidentInclude,
    });

    // Get resolver name
    const resolver = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });

    // Emit real-time event to school room
    this.gateway.emitIncidentResolved(schoolId, {
      incidentId: incident.id,
      studentName: `${incident.student.firstName} ${incident.student.lastName}`,
      resolvedByName: resolver
        ? `${resolver.firstName} ${resolver.lastName}`
        : 'Unknown',
      resolvedAt: incident.resolvedAt!,
    });

    return incident;
  }

  async delete(schoolId: string, id: string): Promise<Incident> {
    await this.findOne(schoolId, id);

    const tenantDb = this.prisma.forTenant(schoolId);

    return (tenantDb.incident as any).update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findByStatus(
    schoolId: string,
    status: IncidentStatus,
  ): Promise<IncidentWithDetails[]> {
    const tenantDb = this.prisma.forTenant(schoolId);

    return (tenantDb.incident as any).findMany({
      where: { status, deletedAt: null },
      include: incidentInclude,
      orderBy: {
        dispatchedAt: 'desc',
      },
    });
  }
}
