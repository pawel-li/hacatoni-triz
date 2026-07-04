import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePromptDto {
  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsOptional()
  @IsString()
  @IsIn(['triz', 'biomimicry', 'both'])
  method?: 'triz' | 'biomimicry' | 'both';
}
