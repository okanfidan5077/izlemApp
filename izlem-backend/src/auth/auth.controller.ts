import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto';
import { Public } from './decorators';
import { JwtAuthGuard } from './guards';
import { CurrentUser, TenantUser } from '../common/decorators';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register a new user
   * POST /auth/register
   */
  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  /**
   * Login with credentials
   * POST /auth/login
   */
  @Public()
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  /**
   * Forgot password - sends reset link
   * POST /auth/forgot-password
   */
  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }) {
    return this.authService.forgotPassword(body.email);
  }

  /**
   * Validate student exists in a school (for parent registration)
   * GET /auth/validate-student/:schoolId/:studentId
   */
  @Public()
  @Get('validate-student/:schoolId/:studentId')
  async validateStudent(
    @Param('schoolId') schoolId: string,
    @Param('studentId') studentId: string,
  ) {
    return this.authService.validateStudent(schoolId, studentId);
  }

  /**
   * Get current user profile
   * GET /auth/me
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@CurrentUser() user: TenantUser) {
    return this.authService.getProfile(user.userId);
  }
}
