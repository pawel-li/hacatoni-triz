import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePromptDto {
  @IsString()
  @IsNotEmpty()
  text!: string;
}
