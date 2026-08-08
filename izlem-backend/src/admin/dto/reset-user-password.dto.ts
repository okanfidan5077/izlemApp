import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetUserPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;
}
