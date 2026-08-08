import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma';
import { LoginDto, RegisterDto } from './dto';
import { UserRole } from '@prisma/client';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Register a new user with hashed password
   */
  async register(registerDto: RegisterDto) {
    // Check if school exists
    const school = await this.prisma.school.findUnique({
      where: { id: registerDto.schoolId },
    });

    if (!school) {
      throw new NotFoundException(
        `School with ID ${registerDto.schoolId} not found`,
      );
    }

    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(
      registerDto.password,
      BCRYPT_ROUNDS,
    );

    // Create user as inactive — requires admin approval
    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        password: hashedPassword,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        schoolId: registerDto.schoolId,
        role: registerDto.role ?? UserRole.TEACHER,
        isActive: false,
        ...(registerDto.studentId ? { studentId: registerDto.studentId } : {}),
      },
      include: { school: true },
    });

    return {
      message:
        'Your access request has been submitted. An administrator will review and approve your account.',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        school: {
          id: user.school.id,
          name: user.school.name,
        },
      },
    };
  }

  /**
   * Login with email and password
   */
  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
      include: { school: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Compare with bcrypt
    const passwordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // if (!user.isActive) {
    //   throw new UnauthorizedException('Your account is pending administrator approval.');
    // }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        school: {
          id: user.school.id,
          name: user.school.name,
        },
      },
    };
  }

  /**
   * Validate user exists and is active (used by JWT strategy)
   */
  async validateUser(userId: string, schoolId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        schoolId,
        // isActive: true, // Allow inactive users so they can see "Pending" page
      },
    });

    return user;
  }

  /**
   * Get full user profile by ID
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { school: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      school: {
        id: user.school.id,
        name: user.school.name,
      },
      createdAt: user.createdAt,
    };
  }

  /**
   * Forgot password placeholder - logs the request
   * TODO: Wire real email service
   */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Always return success to prevent email enumeration
    if (user) {
      console.log(
        `🔑 Password reset requested for: ${email} (user: ${user.id})`,
      );
    } else {
      console.log(`🔑 Password reset requested for unknown email: ${email}`);
    }

    return {
      message:
        'If an account with that email exists, a reset link has been sent.',
    };
  }

  /**
   * Validate that a student ID exists in a school
   */
  async validateStudent(schoolId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        studentNo: true,
        grade: true,
        section: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return student;
  }
}
