import { IsString, IsNotEmpty } from 'class-validator';

export class CreateConversationDto {
  @IsString()
  @IsNotEmpty()
  teacherId!: string;

  @IsString()
  @IsNotEmpty()
  parentId!: string;
}
